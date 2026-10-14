import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import type { FullConfig, FullResult, Reporter, TestCase, TestResult, TestStep } from '@playwright/test/reporter';

// Prints the result of each test (PASS / FAIL / ABORTED, duration, failed step and reason, video location) and keeps the
// evidence of every run under artifacts/evidence/<KEY>/<YYYYMMDD-HHMMSS>_<STATUS>/ . That folder is outside Playwright's
// outputDir (artifacts/test-output, wiped on each run), and a run only ever adds a new folder, so earlier evidence is kept.
//   PASS     the test passed.
//   FAIL     an expectation was not met (assertion failure, including soft assertions).
//   ABORTED  the test could not run to completion: an error starting with "ABORTED:", a failed sign-in fixture,
//            a network error reaching the Director, a test timeout, an interruption, or a skip.
export type RunStatus = 'PASS' | 'FAIL' | 'ABORTED';

const ABORT_PATTERNS = [
  /^(?:Error: )?ABORTED:/m, // a spec throws "ABORTED: ..."; Playwright reports it as "Error: ABORTED: ..."
  /signedIn fixture:/,
  /inventorySession fixture:/,
  /Missing in \.env at the repository root/,
  /net::ERR_(CONNECTION|CERT|NAME_NOT_RESOLVED|ADDRESS_UNREACHABLE|TIMED_OUT|INTERNET_DISCONNECTED)/,
  /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/,
];

// WebM (Playwright's recording, about 800 kb/s) to MP4: H.264, 10 frames per second, CRF 30, no audio. The screen is mostly still, so the
// size drops to about a seventh (10.5 min of 1920x1080: 64 MB -> 9 MB, 2026-10-13). The ffmpeg binary comes from the ffmpeg-static
// package (Playwright's own ffmpeg writes only WebM). Returns false when ffmpeg is missing or fails: the caller keeps the WebM.
function convertToMp4(source: string, target: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpeg = require('ffmpeg-static') as string | null;
    if (!ffmpeg) return false;
    const run = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-c:v', 'libx264', '-preset', 'medium', '-crf', '30', '-r', '10', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', target], { timeout: 600_000 });
    return run.status === 0 && fs.existsSync(target) && fs.statSync(target).size > 0;
  } catch {
    return false;
  }
}

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, '');
const pad = (value: number): string => String(value).padStart(2, '0');

export function classify(result: Pick<TestResult, 'status' | 'errors'>): RunStatus {
  if (result.status === 'passed') return 'PASS';
  if (result.status === 'failed') {
    const text = result.errors.map((error) => stripAnsi(error.message ?? '')).join('\n');
    return ABORT_PATTERNS.some((pattern) => pattern.test(text)) ? 'ABORTED' : 'FAIL';
  }
  return 'ABORTED'; // timedOut, interrupted, skipped
}

interface Entry {
  key: string;
  title: string;
  status: RunStatus;
  startedAt: Date;
  durationMs: number;
  steps: { title: string; ok: boolean; error?: string }[];
  errors: string[];
  attachments: TestResult['attachments'];
}

const firstLines = (text: string, count: number): string =>
  stripAnsi(text).split('\n').filter((line) => line.trim().length > 0).slice(0, count).join(' | ');

class StatusReporter implements Reporter {
  private readonly entries = new Map<string, Entry>();
  // Evidence goes under the repository root whatever the working directory is: the folder of the Playwright config file.
  private root = process.cwd();

  onBegin(config: FullConfig): void {
    if (config.configFile) this.root = path.dirname(config.configFile);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const tag = test.tags.find((value) => /^@NJM-\d+$/.test(value));
    const steps = result.steps
      .filter((step: TestStep) => step.category === 'test.step')
      .map((step) => ({ title: step.title, ok: !step.error, error: step.error ? firstLines(step.error.message ?? '', 2) : undefined }));
    // The last attempt of a test wins (no retries are configured).
    this.entries.set(test.id, {
      key: tag ? tag.slice(1) : 'no-xray-key',
      title: test.title,
      status: classify(result),
      startedAt: result.startTime,
      durationMs: result.duration,
      steps,
      errors: result.errors.map((error) => stripAnsi(error.message ?? '')),
      attachments: result.attachments,
    });
  }

  onEnd(_result: FullResult): void {
    if (this.entries.size === 0) return;
    const line = '='.repeat(78);
    console.log(`\n${line}\nTEST EXECUTION STATUS\n${line}`);
    const counts: Record<RunStatus, number> = { PASS: 0, FAIL: 0, ABORTED: 0 };

    for (const entry of this.entries.values()) {
      counts[entry.status]++;
      const seconds = Math.round(entry.durationMs / 1000);
      console.log(`\n[${entry.status}] ${entry.key}  duration ${Math.floor(seconds / 60)}m ${seconds % 60}s\n  ${entry.title}`);
      for (const step of entry.steps) console.log(`    ${step.ok ? 'OK  ' : 'FAIL'} ${step.title}${step.error ? `\n         -> ${step.error}` : ''}`);
      const failedStep = entry.steps.find((step) => !step.ok);
      if (entry.status !== 'PASS') {
        if (failedStep) console.log(`  Failed step: ${failedStep.title}`);
        if (entry.errors[0]) console.log(`  Reason: ${firstLines(entry.errors[0], 3)}`);
      }

      const video = entry.attachments.find((attachment) => attachment.name === 'video' && attachment.path && fs.existsSync(attachment.path));
      // Started by the automation tool: it names a unique, empty run folder (QA_RUN_DIR) and passes the run settings.
      const toolDir = process.env.QA_RUN_DIR;
      if (!toolDir && entry.key === 'no-xray-key' && !video) continue; // keep evidence only for Xray-tagged tests or tests with a video

      const d = entry.startedAt;
      const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      let dir = toolDir ? path.resolve(toolDir) : path.join(this.root, 'artifacts', 'evidence', entry.key, `${stamp}_${entry.status}`);
      if (!toolDir) {
        // A standalone run never reuses a folder: two runs that end in the same second get -2, -3, ...
        const first = dir;
        for (let n = 2; fs.existsSync(dir); n++) dir = `${first}-${n}`;
      }
      fs.mkdirSync(dir, { recursive: true });

      let videoFile: string | undefined;
      if (video?.path) {
        // The evidence video is an MP4 (H.264, small). If it cannot be made, the raw WebM is kept instead, so a video is never lost.
        videoFile = path.join(dir, `${entry.key}_${entry.status}_${stamp}.mp4`);
        if (!convertToMp4(video.path, videoFile)) {
          fs.rmSync(videoFile, { force: true }); // a partial file from the failed conversion
          videoFile = path.join(dir, `${entry.key}_${entry.status}_${stamp}.webm`);
          fs.copyFileSync(video.path, videoFile);
        }
      }
      // Everything else Playwright attached: trace.zip, failure screenshot, error-context, and the test's own step screenshots.
      const kept: string[] = [];
      for (const attachment of entry.attachments) {
        if (attachment === video) continue;
        const extension = attachment.contentType === 'image/png' ? '.png' : attachment.contentType === 'application/zip' ? '.zip' : attachment.path ? path.extname(attachment.path) : '.txt';
        const name = `${attachment.name.replace(/[^\w.-]+/g, '_')}${path.extname(attachment.name) ? '' : extension}`;
        try {
          if (attachment.path && fs.existsSync(attachment.path)) fs.copyFileSync(attachment.path, path.join(dir, name));
          else if (attachment.body) fs.writeFileSync(path.join(dir, name), attachment.body);
          else continue;
          kept.push(name);
        } catch {
          // A missing optional attachment must not break reporting.
        }
      }
      fs.writeFileSync(
        path.join(dir, 'status.json'),
        JSON.stringify(
          {
            key: entry.key, title: entry.title, status: entry.status, startedAt: entry.startedAt.toISOString(), durationMs: entry.durationMs, failedStep: failedStep?.title ?? null, errors: entry.errors, steps: entry.steps, video: videoFile ? path.basename(videoFile) : null, files: kept,
            // Present only when the automation tool started the run (environment variables set by tool/runner/run-case.ts).
            run: toolDir ? { runId: process.env.QA_RUN_ID ?? null, executionKey: process.env.QA_EXECUTION_KEY || null, build: process.env.QA_BUILD || null, fixVersion: process.env.QA_FIX_VERSION || null, tenancy: process.env.QA_TENANCY || null } : undefined,
          },
          null,
          2,
        ),
      );
      console.log(`  Video:    ${videoFile ?? '(none recorded)'}`);
      console.log(`  Evidence: ${dir}`);
    }

    console.log(`\nSUMMARY: PASS ${counts.PASS} | FAIL ${counts.FAIL} | ABORTED ${counts.ABORTED}\n${line}`);
  }
}

export default StatusReporter;
