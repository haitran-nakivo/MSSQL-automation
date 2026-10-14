import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../config/env.ts';
import type { ToolConfig } from '../config/env.ts';
import { preflightFailed, runPreflight } from '../preflight/checks.ts';
import type { CheckResult } from '../preflight/checks.ts';
import type { CaseInfo } from '../registry/registry.ts';

// Runs ONE case: pre-flight, then the registered Playwright spec in a child process, then reads the verdict the spec's reporter
// wrote. Nothing here decides PASS or FAIL: the assertions in the spec do, and the status reporter records it. This module only
// maps "no verdict could be produced" to ABORTED.
//
// No AI is involved at any point: the child process is `node playwright test <spec> --grep @<KEY>`.

export type RunStatus = 'PASS' | 'FAIL' | 'ABORTED';

export interface RunSettings {
  build: string;
  fixVersion: string;
  tenancy: string;
  headed: boolean;
  executionKey: string | null;
}

export interface RunStep {
  title: string;
  ok: boolean;
  error?: string;
}

export interface RunResult {
  runId: string;
  key: string;
  title: string | null;
  status: RunStatus;
  reason: string;
  failedStep: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  settings: RunSettings;
  // Run folder relative to the repository root, with forward slashes (safe to show and to put in a comment).
  runDir: string;
  video: string | null;
  files: string[];
  steps: RunStep[];
  preflight: CheckResult[];
  exitCode: number | null;
  scopeLine: string | null;
  notVerified: string | null;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const stamp = (d: Date): string => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

// A new folder for every run: <repo>/artifacts/evidence/<KEY>/<stamp>_<random>. Nothing in the tool deletes or reuses a folder,
// and it is outside Playwright's outputDir (artifacts/test-output), which Playwright wipes at the start of a run.
export function createRunDir(key: string, now = new Date(), baseDir = join(REPO_ROOT, 'artifacts', 'evidence')): { runId: string; dir: string } {
  const runId = `${stamp(now)}_${randomBytes(3).toString('hex')}`;
  const dir = join(baseDir, key, runId);
  if (existsSync(dir)) throw new Error(`Run folder already exists: ${dir}`);
  mkdirSync(dir, { recursive: true });
  return { runId, dir };
}

// Settings reach the spec as environment variables; strip anything that is not plain text.
const clean = (value: string): string => value.replace(/[^\x20-\x7e]/g, '').trim().slice(0, 120);
export function sanitizeSettings(input: Partial<RunSettings>): RunSettings {
  return { build: clean(input.build ?? ''), fixVersion: clean(input.fixVersion ?? ''), tenancy: clean(input.tenancy ?? ''), headed: input.headed !== false, executionKey: input.executionKey ? clean(input.executionKey) : null };
}

const rel = (path: string): string => path.slice(REPO_ROOT.length + 1).replaceAll('\\', '/');

function killTree(pid: number): void {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else process.kill(-pid, 'SIGKILL');
}

interface StatusFile {
  status?: RunStatus;
  title?: string;
  startedAt?: string;
  durationMs?: number;
  failedStep?: string | null;
  errors?: string[];
  steps?: RunStep[];
  video?: string | null;
  files?: string[];
}

const firstLines = (text: string, count: number): string => text.split('\n').filter((l) => l.trim().length > 0).slice(0, count).join(' | ');

const playwrightCli = join(REPO_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

// Offline check, no browser: exactly one test must carry the case's tag. With none (a renamed tag) or several, the run could not
// produce one verdict, so it is stopped as ABORTED before anything is started.
function countTests(spec: string, key: string): Promise<{ count: number | null; output: string }> {
  return new Promise((resolveCount) => {
    const child = spawn(process.execPath, [playwrightCli, 'test', '--list', '--reporter=list', spec, '--grep', `@${key}`], { cwd: REPO_ROOT, env: { ...process.env, FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString('utf8'); });
    child.on('error', (error) => resolveCount({ count: null, output: error.message }));
    child.on('close', () => {
      const total = /Total:\s+(\d+)\s+tests?/.exec(output);
      resolveCount({ count: total ? Number(total[1]) : /No tests found/i.test(output) ? 0 : null, output });
    });
  });
}

export async function runCase(info: CaseInfo, rawSettings: Partial<RunSettings>, config: ToolConfig, onLog: (line: string) => void = () => {}): Promise<RunResult> {
  const implementation = info.implementation;
  if (!implementation) throw new Error(`${info.key} has no automation registered`);
  const settings = sanitizeSettings(rawSettings);
  const startedAt = new Date();
  const { runId, dir } = createRunDir(info.key, startedAt);
  const finish = (status: RunStatus, reason: string, extra: Partial<RunResult> = {}): RunResult => {
    const finishedAt = new Date();
    const result: RunResult = {
      runId, key: info.key, title: info.title, status, reason, failedStep: null,
      startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), durationMs: finishedAt.getTime() - startedAt.getTime(),
      settings, runDir: rel(dir), video: null, files: [], steps: [], preflight: [], exitCode: null,
      scopeLine: info.scopeLine, notVerified: info.notVerified, ...extra,
    };
    writeFileSync(join(dir, 'result.json'), JSON.stringify(result, null, 2));
    return result;
  };

  onLog(`Run ${runId} started for ${info.key}`);
  const preflight = await runPreflight(implementation, config, settings);
  for (const check of preflight) onLog(`pre-flight ${check.id}: ${check.status} - ${check.detail}`);
  const failed = preflightFailed(preflight);
  if (failed) return finish('ABORTED', `Pre-flight failed (${failed.id}): ${failed.detail}`, { preflight });

  const found = await countTests(implementation.spec, info.key);
  onLog(`tests tagged @${info.key} in ${implementation.spec}: ${found.count ?? 'unknown'}`);
  if (found.count !== 1) {
    const why = found.count === null ? `Could not list the tests of ${implementation.spec}: ${firstLines(found.output, 3)}` : `Expected exactly one test tagged @${info.key} in ${implementation.spec}, found ${found.count}`;
    return finish('ABORTED', why, { preflight });
  }

  // --output keeps Playwright's raw files (video, trace) inside this run's folder, so they survive a killed run and are never wiped.
  const args = [playwrightCli, 'test', implementation.spec, '--grep', `@${info.key}`, '--workers=1', '--retries=0', '--output', join(dir, 'pw-output')];
  if (settings.headed) args.push('--headed');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    QA_RUN_DIR: dir,
    QA_RUN_ID: runId,
    QA_CASE_KEY: info.key,
    QA_EXECUTION_KEY: settings.executionKey ?? '',
    QA_BUILD: settings.build,
    QA_FIX_VERSION: settings.fixVersion,
    QA_TENANCY: settings.tenancy,
    PLAYWRIGHT_HTML_REPORT: join(dir, 'html-report'),
    PLAYWRIGHT_HTML_OPEN: 'never',
    FORCE_COLOR: '0',
  };

  const log = createWriteStream(join(dir, 'run.log'), { flags: 'a' });
  const exitCode = await new Promise<number | null>((resolveExit) => {
    const child = spawn(process.execPath, args, { cwd: REPO_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      onLog(`Timeout of ${Math.round(implementation.timeoutMs / 60_000)} min reached; stopping the run`);
      if (child.pid) killTree(child.pid);
    }, implementation.timeoutMs);
    const forward = (chunk: Buffer): void => {
      log.write(chunk);
      for (const line of chunk.toString('utf8').split(/\r?\n/)) if (line.trim()) onLog(line);
    };
    child.stdout.on('data', forward);
    child.stderr.on('data', forward);
    child.on('error', (error) => {
      clearTimeout(timer);
      onLog(`Could not start Playwright: ${error.message}`);
      resolveExit(null);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveExit(timedOut ? -1 : code);
    });
  });
  log.end();

  if (exitCode === -1) return finish('ABORTED', `The run exceeded the ${Math.round(implementation.timeoutMs / 60_000)} minute limit and was stopped`, { preflight, exitCode });

  // The verdict is whatever the spec's reporter wrote. No status file means the run never reached a verdict.
  const statusPath = join(dir, 'status.json');
  if (!existsSync(statusPath)) return finish('ABORTED', `Playwright ended (exit code ${exitCode}) without writing a result file`, { preflight, exitCode });
  let status: StatusFile;
  try {
    status = JSON.parse(readFileSync(statusPath, 'utf8')) as StatusFile;
  } catch {
    return finish('ABORTED', 'The result file written by the run could not be read', { preflight, exitCode });
  }
  if (status.status !== 'PASS' && status.status !== 'FAIL' && status.status !== 'ABORTED') return finish('ABORTED', 'The result file has no valid status', { preflight, exitCode });
  // PASS is trusted only when the process agrees; a PASS with a failing exit code means something is wrong with the run.
  if (status.status === 'PASS' && exitCode !== 0) return finish('ABORTED', `The reporter says PASS but Playwright exited with code ${exitCode}`, { preflight, exitCode });

  const files = readdirSync(dir).filter((name) => statSync(join(dir, name)).isFile());
  return finish(status.status, status.status === 'PASS' ? '' : firstLines(status.errors?.[0] ?? '', 3), {
    preflight,
    exitCode,
    failedStep: status.failedStep ?? null,
    steps: status.steps ?? [],
    video: status.video ?? null,
    files,
    durationMs: typeof status.durationMs === 'number' ? status.durationMs : Date.now() - startedAt.getTime(),
  });
}

// Previous runs of a case, newest first. A run started by the tool has a result.json; any other run (started with npm run
// test:njm-187289 or the editor) has only the reporter's status.json, so a summary is built from that. Deletes nothing.
export function listRuns(key: string): RunResult[] {
  const base = join(REPO_ROOT, 'artifacts', 'evidence', key);
  if (!existsSync(base)) return [];
  const runs: RunResult[] = [];
  for (const name of readdirSync(base)) {
    const dir = join(base, name);
    try {
      if (existsSync(join(dir, 'result.json'))) {
        runs.push(JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8')) as RunResult);
      } else if (existsSync(join(dir, 'status.json'))) {
        const s = JSON.parse(readFileSync(join(dir, 'status.json'), 'utf8')) as StatusFile & { run?: { runId?: string | null } };
        const started = s.startedAt ?? new Date(statSync(dir).mtimeMs).toISOString();
        runs.push({
          runId: name, key, title: s.title ?? null, status: s.status ?? 'ABORTED', reason: firstLines(s.errors?.[0] ?? '', 3), failedStep: s.failedStep ?? null,
          startedAt: started, finishedAt: new Date(Date.parse(started) + (s.durationMs ?? 0)).toISOString(), durationMs: s.durationMs ?? 0,
          settings: { build: '', fixVersion: '', tenancy: '', headed: true, executionKey: null }, runDir: rel(dir), video: s.video ?? null,
          files: readdirSync(dir).filter((n) => statSync(join(dir, n)).isFile()), steps: s.steps ?? [], preflight: [], exitCode: null, scopeLine: null, notVerified: null,
        });
      }
    } catch {
      // A damaged run folder is skipped, never deleted.
    }
  }
  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
