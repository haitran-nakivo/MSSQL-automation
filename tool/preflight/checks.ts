import * as http from 'node:http';
import * as https from 'node:https';
import type { ToolConfig } from '../config/env.ts';
import type { Implementation } from '../registry/implementations.ts';

// Checks made before a browser is started. A failed check ends the run as ABORTED with the reason; it is never a FAIL,
// because nothing about the product was verified. Each check reports ok, failed or skipped (skipped = not implemented or not
// applicable; the result says so instead of pretending the check passed).

export interface CheckResult {
  id: string;
  status: 'ok' | 'failed' | 'skipped';
  detail: string;
}

// GET <base>/c/login with certificate errors ignored (the lab Director has an untrusted certificate, as the Playwright
// config also assumes). Any answer below HTTP 500 means the Director is up.
function probe(baseUrl: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    const url = new URL('/c/login', baseUrl);
    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(url, { method: 'GET', timeout: 15_000, rejectUnauthorized: false }, (response) => {
      response.resume();
      const code = response.statusCode ?? 0;
      resolve(code > 0 && code < 500 ? { id: 'director', status: 'ok', detail: `Director answered HTTP ${code}` } : { id: 'director', status: 'failed', detail: `Director answered HTTP ${code}` });
    });
    request.on('timeout', () => request.destroy(new Error('timed out after 15 s')));
    request.on('error', (error) => resolve({ id: 'director', status: 'failed', detail: `Director is not reachable: ${error.message}` }));
    request.end();
  });
}

export async function runPreflight(implementation: Implementation, config: ToolConfig, settings: { build: string }): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const missing = implementation.requiresEnv.filter((name) => !process.env[name]);
  results.push(
    missing.length === 0
      ? { id: 'env', status: 'ok', detail: `${implementation.requiresEnv.length} required variables are set in .env` }
      : { id: 'env', status: 'failed', detail: `Missing in .env at the repository root: ${missing.join(', ')}` },
  );

  if (implementation.requires.includes('director')) {
    results.push(config.nakivoBaseUrl ? await probe(config.nakivoBaseUrl) : { id: 'director', status: 'failed', detail: 'Missing in .env at the repository root: NAKIVO_BASE_URL' });
  }

  if (implementation.requires.includes('build')) {
    // The Director's build is not read from an interface that has been verified, so it cannot be compared yet. The entered
    // Build is recorded in the result and in the Xray comment; the check says it was not compared.
    results.push({
      id: 'build',
      status: 'skipped',
      detail: settings.build ? `Build "${settings.build}" is recorded but not compared with the Director (build detection is not implemented)` : 'No Build entered; nothing to record',
    });
  }
  return results;
}

export const preflightFailed = (results: CheckResult[]): CheckResult | undefined => results.find((r) => r.status === 'failed');
