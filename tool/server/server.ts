import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import * as http from 'node:http';
import { extname, join } from 'node:path';
import { REPO_ROOT, requireJira } from '../config/env.ts';
import type { ToolConfig } from '../config/env.ts';
import { getExecution, isIssueKey } from '../jira/xray-client.ts';
import { publishResult } from '../publish/publisher.ts';
import type { PublishRecord } from '../publish/publisher.ts';
import { implementedCases, registryStats, resolveCase, validateRegistry } from '../registry/registry.ts';
import { listRuns, runCase } from '../runner/run-case.ts';
import type { RunResult, RunSettings } from '../runner/run-case.ts';

// Local control interface for the automation tool. Loopback only. It lists the tests of an Xray Test Execution, starts one
// registered Playwright case at a time, and publishes its result. It contains no test logic and no AI.

type XrayMode = 'none' | 'dry-run' | 'publish';

interface Job {
  id: string;
  key: string;
  executionKey: string | null;
  testRunId: number | null;
  xrayMode: XrayMode;
  state: 'running' | 'done';
  startedAt: string;
  log: string[];
  result?: RunResult;
  publish?: PublishRecord;
  error?: string;
}

const MAX_LOG_LINES = 500;
// Run folder names: <stamp>_<random> for tool runs, <stamp>_<STATUS> or <stamp>_<STATUS>-2 for runs started another way.
const RUN_ID_PATTERN = /^\d{8}-\d{6}_[A-Za-z0-9-]+$/;
const FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const TYPES: Record<string, string> = { '.webm': 'video/webm', '.mp4': 'video/mp4', '.png': 'image/png', '.json': 'application/json', '.log': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.zip': 'application/zip' };

export function startServer(config: ToolConfig): http.Server {
  const jobs = new Map<string, Job>();
  const indexHtml = (): string => readFileSync(join(import.meta.dirname, '..', 'ui', 'index.html'), 'utf8');
  const allowedHosts = new Set([`127.0.0.1:${config.port}`, `localhost:${config.port}`]);

  const send = (res: http.ServerResponse, code: number, body: unknown): void => {
    const text = JSON.stringify(body);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(text);
  };
  const fail = (res: http.ServerResponse, code: number, message: string): void => send(res, code, { error: message });

  const readJson = (req: http.IncomingMessage): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 65_536) { reject(new Error('Request body is too large')); req.destroy(); return; }
        chunks.push(chunk);
      });
      req.on('end', () => {
        try {
          const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
          resolve(value as Record<string, unknown>);
        } catch {
          reject(new Error('Request body is not a JSON object'));
        }
      });
      req.on('error', reject);
    });

  const tail = (job: Job, onLog = true): ((line: string) => void) => (line: string): void => {
    if (!onLog) return;
    job.log.push(line);
    if (job.log.length > MAX_LOG_LINES) job.log.splice(0, job.log.length - MAX_LOG_LINES);
  };

  async function handleExecution(res: http.ServerResponse, key: string): Promise<void> {
    if (!isIssueKey(key)) return fail(res, 400, `"${key}" is not an issue key`);
    let auth: ReturnType<typeof requireJira>;
    try {
      auth = requireJira(config);
    } catch (error) {
      return fail(res, 400, (error as Error).message);
    }
    try {
      const execution = await getExecution(auth, config, key);
      const tests = execution.tests.map((test) => {
        const info = resolveCase(test.key);
        const last = listRuns(test.key)[0];
        return {
          ...test,
          case: { state: info.state, canExecute: info.canExecute, reason: info.reason, area: info.area, priority: info.priority, scopeLine: info.scopeLine, notVerified: info.notVerified },
          lastRun: last ? { runId: last.runId, status: last.status, startedAt: last.startedAt } : null,
        };
      });
      const counts: Record<string, number> = {};
      for (const t of tests) counts[t.case.state] = (counts[t.case.state] ?? 0) + 1;
      send(res, 200, { execution: { ...execution, tests: undefined }, tests, counts });
    } catch (error) {
      fail(res, 502, (error as Error).message);
    }
  }

  async function handleRun(res: http.ServerResponse, body: Record<string, unknown>): Promise<void> {
    const key = String(body.caseKey ?? '');
    const info = isIssueKey(key) ? resolveCase(key) : null;
    if (!info) return fail(res, 400, 'caseKey is not an issue key');
    if (!info.canExecute) return fail(res, 400, `${key} cannot be executed: ${info.reason}`);
    const xrayMode = String(body.xrayMode ?? 'none') as XrayMode;
    if (!['none', 'dry-run', 'publish'].includes(xrayMode)) return fail(res, 400, 'xrayMode must be none, dry-run or publish');
    const executionKey = body.executionKey ? String(body.executionKey) : null;
    if (executionKey !== null && !isIssueKey(executionKey)) return fail(res, 400, 'executionKey is not an issue key');
    if (xrayMode !== 'none' && executionKey === null) return fail(res, 400, 'An execution key is needed to report to Xray');
    if ([...jobs.values()].some((j) => j.state === 'running')) return fail(res, 409, 'Another run is in progress; one run at a time keeps the lab hosts safe');
    const settings = (typeof body.settings === 'object' && body.settings !== null ? body.settings : {}) as Partial<RunSettings>;

    const job: Job = {
      id: randomBytes(4).toString('hex'), key, executionKey,
      testRunId: typeof body.testRunId === 'number' ? body.testRunId : null,
      xrayMode, state: 'running', startedAt: new Date().toISOString(), log: [],
    };
    jobs.set(job.id, job);
    send(res, 202, { jobId: job.id });

    const log = tail(job);
    try {
      job.result = await runCase(info, { ...settings, executionKey }, config, log);
      log(`Result: ${job.result.status}${job.result.reason ? ` - ${job.result.reason}` : ''}`);
      if (xrayMode !== 'none' && executionKey) {
        log(xrayMode === 'dry-run' ? 'Xray dry run: building the update, nothing is written' : 'Publishing the result to Xray');
        job.publish = await publishResult(config, job.result, executionKey, { dryRun: xrayMode === 'dry-run', testRunId: job.testRunId });
        for (const e of job.publish.errors) log(`Xray: ${e}`);
      }
    } catch (error) {
      job.error = (error as Error).message;
      log(`Tool error: ${job.error}`);
    } finally {
      job.state = 'done';
    }
  }

  async function handlePublish(res: http.ServerResponse, job: Job, body: Record<string, unknown>): Promise<void> {
    if (job.state !== 'done' || !job.result) return fail(res, 409, 'The run has not finished');
    if (!job.executionKey) return fail(res, 400, 'This run has no execution key');
    const mode = String(body.mode ?? 'publish');
    if (mode !== 'dry-run' && mode !== 'publish') return fail(res, 400, 'mode must be dry-run or publish');
    try {
      job.publish = await publishResult(config, job.result, job.executionKey, { dryRun: mode === 'dry-run', testRunId: job.testRunId });
      send(res, 200, job);
    } catch (error) {
      fail(res, 500, (error as Error).message);
    }
  }

  function serveFile(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
    const key = url.searchParams.get('key') ?? '';
    const run = url.searchParams.get('run') ?? '';
    const name = url.searchParams.get('name') ?? '';
    if (!isIssueKey(key) || !RUN_ID_PATTERN.test(run) || !FILE_NAME_PATTERN.test(name)) return fail(res, 400, 'Bad file request');
    const path = join(REPO_ROOT, 'artifacts', 'evidence', key, run, name);
    if (!existsSync(path) || !statSync(path).isFile()) return fail(res, 404, 'File not found');
    const size = statSync(path).size;
    const type = TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      createReadStream(path, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
    createReadStream(path).pipe(res);
  }

  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        // Loopback only, and a request must name this server: blocks DNS-rebinding and drive-by requests from other sites.
        if (!allowedHosts.has(String(req.headers.host ?? ''))) return fail(res, 403, 'Forbidden host');
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
        const parts = url.pathname.split('/').filter(Boolean);
        if (req.method === 'POST' && (req.headers['x-qa-tool'] !== '1' || !String(req.headers['content-type'] ?? '').startsWith('application/json'))) return fail(res, 403, 'Missing tool headers');

        if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(indexHtml()); return; }
        if (req.method === 'GET' && url.pathname === '/api/config') {
          return send(res, 200, { jiraConfigured: Boolean(config.jiraBaseUrl && config.jiraToken), jiraBaseUrl: config.jiraBaseUrl, nakivoBaseUrlSet: Boolean(config.nakivoBaseUrl), registry: registryStats(), registryProblems: validateRegistry() });
        }
        // The cases that can be run, with no Jira needed: what is implemented, whether its .env variables are set, and its last run.
        if (req.method === 'GET' && url.pathname === '/api/cases') {
          return send(res, 200, {
            cases: implementedCases().map((c) => ({
              key: c.key, title: c.title, spec: c.implementation?.spec, scopeLine: c.scopeLine, notVerified: c.notVerified,
              missingEnv: (c.implementation?.requiresEnv ?? []).filter((name) => !process.env[name]),
              lastRun: listRuns(c.key)[0] ?? null,
            })),
          });
        }
        // Opens a run's evidence folder in Windows Explorer. Only a folder under artifacts/evidence/<KEY>/<run> can be opened.
        if (req.method === 'POST' && url.pathname === '/api/open') {
          const body = await readJson(req);
          const key = String(body.key ?? '');
          const run = String(body.run ?? '');
          if (process.platform !== 'win32') return fail(res, 400, 'Opening a folder is supported on Windows only');
          if (!isIssueKey(key) || !RUN_ID_PATTERN.test(run)) return fail(res, 400, 'Bad run');
          const folder = join(REPO_ROOT, 'artifacts', 'evidence', key, run);
          if (!existsSync(folder)) return fail(res, 404, 'Folder not found');
          spawn('explorer.exe', [folder], { detached: true, stdio: 'ignore' }).unref();
          return send(res, 200, { opened: folder });
        }
        if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'execution' && parts.length === 3) return await handleExecution(res, decodeURIComponent(parts[2]));
        if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'runs' && parts.length === 3) {
          const key = decodeURIComponent(parts[2]);
          return isIssueKey(key) ? send(res, 200, { runs: listRuns(key) }) : fail(res, 400, 'Not an issue key');
        }
        if (req.method === 'GET' && url.pathname === '/file') return serveFile(req, res, url);
        if (req.method === 'POST' && url.pathname === '/api/run') return await handleRun(res, await readJson(req));
        if (parts[0] === 'api' && parts[1] === 'jobs' && parts.length >= 3) {
          const job = jobs.get(parts[2]);
          if (!job) return fail(res, 404, 'Unknown job');
          if (req.method === 'GET' && parts.length === 3) return send(res, 200, job);
          if (req.method === 'POST' && parts[3] === 'publish') return await handlePublish(res, job, await readJson(req));
        }
        fail(res, 404, 'Not found');
      } catch (error) {
        if (!res.headersSent) fail(res, 400, (error as Error).message);
      }
    })();
  });
  server.listen(config.port, '127.0.0.1');
  return server;
}
