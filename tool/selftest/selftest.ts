import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../config/env.ts';
import type { ToolConfig } from '../config/env.ts';
import { jiraRequest } from '../jira/http.ts';
import { getExecution } from '../jira/xray-client.ts';
import { buildComment } from '../publish/comment.ts';
import { publishResult } from '../publish/publisher.ts';
import { resolveCase, validateRegistry } from '../registry/registry.ts';
import { createRunDir, sanitizeSettings } from '../runner/run-case.ts';
import type { RunResult } from '../runner/run-case.ts';
import { classify } from '../../reporters/status.reporter.ts';
import { MOCK_EXECUTION, MOCK_RUN_ID, MOCK_TOKEN, startMockXray } from './mock-xray.ts';

// Offline self-test of the framework: node tool/selftest/selftest.ts  (npm run tool:selftest)
// No browser, no NAKIVO, no real Jira: Xray is a local mock. It shows the tool's code does what it should with the request
// shapes taken from Xray's documentation. It does NOT prove the real Xray accepts them (see the verification plan).

let passed = 0;
const failures: string[] = [];
async function check(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed++;
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}\n     ${(error as Error).message}`);
  }
}

const sandbox = join(REPO_ROOT, 'artifacts', 'selftest');
rmSync(sandbox, { recursive: true, force: true }); // only this tool-owned folder is ever removed
mkdirSync(sandbox, { recursive: true });

// ---- registry ----
await check('registry is consistent (spec files exist and carry their tag)', () => assert.deepEqual(validateRegistry(), []));
await check('an implemented case can execute', () => { const c = resolveCase('NJM-187289'); assert.equal(c.state, 'implemented'); assert.equal(c.canExecute, true); assert.ok(c.scopeLine?.includes('Not verified')); });
await check('an excluded case cannot execute and says why', () => { const c = resolveCase('NJM-154618'); assert.equal(c.state, 'excluded'); assert.equal(c.canExecute, false); assert.ok(c.reason.includes('Excluded')); });
await check('an in-scope case without automation is planned, waiting or investigate-first, and cannot execute', () => {
  assert.equal(resolveCase('NJM-154497').canExecute, false);
  assert.equal(resolveCase('NJM-154497').state, 'planned');
  assert.equal(resolveCase('NJM-154526').state, 'waits-for-environment');
  assert.equal(resolveCase('NJM-154498').state, 'investigate-first');
});
await check('an unknown key cannot execute', () => { const c = resolveCase('NJM-999999'); assert.equal(c.state, 'unknown'); assert.equal(c.canExecute, false); });

// ---- result classification (the reporter's rules) ----
await check('PASS / FAIL / ABORTED classification', () => {
  const err = (message: string) => [{ message }];
  assert.equal(classify({ status: 'passed', errors: [] }), 'PASS');
  assert.equal(classify({ status: 'failed', errors: err('expect(received).toBeVisible() failed') }), 'FAIL');
  assert.equal(classify({ status: 'failed', errors: err('ABORTED: the host is already in Inventory') }), 'ABORTED');
  assert.equal(classify({ status: 'failed', errors: err('Error: ABORTED: port 9446 is already open on 10.10.33.136') }), 'ABORTED');
  assert.equal(classify({ status: 'failed', errors: err('Error: expect(received) ABORTED: later in the line') }), 'FAIL');
  assert.equal(classify({ status: 'failed', errors: err('signedIn fixture: the Logout marker is not visible') }), 'ABORTED');
  assert.equal(classify({ status: 'timedOut', errors: [] }), 'ABORTED');
  assert.equal(classify({ status: 'interrupted', errors: [] }), 'ABORTED');
});

// ---- run folders and settings ----
await check('every run gets its own new folder (created inside the self-test sandbox, never in artifacts/evidence)', () => {
  const a = createRunDir('SELFTEST-1', new Date(), join(sandbox, 'runs'));
  const b = createRunDir('SELFTEST-1', new Date(), join(sandbox, 'runs'));
  assert.notEqual(a.dir, b.dir);
  assert.notEqual(a.runId, b.runId);
  assert.ok(a.dir.startsWith(join(sandbox, 'runs')));
});
await check('settings are reduced to plain text', () => {
  const s = sanitizeSettings({ build: '11.2.1\u0000\n.1', fixVersion: ' FV ', tenancy: 'é' });
  assert.equal(s.build, '11.2.1.1');
  assert.equal(s.fixVersion, 'FV');
  assert.equal(s.tenancy, '');
  assert.equal(s.headed, true);
});

// ---- comment ----
const baseResult = (over: Partial<RunResult> = {}): RunResult => ({
  runId: '20261010-101010_abcdef', key: 'NJM-187289', title: 'Mock title', status: 'PASS', reason: '', failedStep: null,
  startedAt: '2026-10-10T10:10:10.000Z', finishedAt: '2026-10-10T10:12:00.000Z', durationMs: 110_000,
  settings: { build: '11.2.1.112232', fixVersion: 'MS SQL DB support branch', tenancy: 'single', headed: true, executionKey: MOCK_EXECUTION },
  runDir: 'artifacts/selftest/run1', video: 'NJM-187289_PASS_x.webm', files: ['evidence-1.png', 'status.json', 'NJM-187289_PASS_x.webm'],
  steps: [{ title: 'one', ok: true }, { title: 'two', ok: true }], preflight: [{ id: 'build', status: 'skipped', detail: 'not compared' }], exitCode: 0,
  scopeLine: 'Scope line text.', notVerified: 'Something the UI does not show.', ...over,
});
await check('comment carries status, settings, scope, not-verified and evidence', () => {
  const c = buildComment(baseResult(), { uploaded: ['a.webm'], skipped: [{ name: 'b.zip', reason: 'too big' }] });
  for (const part of ['[PASS] NJM-187289', 'Build: 11.2.1.112232', 'Tenancy: single', 'Duration: 1m 50s', 'Scope: Scope line text.', 'Not verified: Something', 'Steps: 2 of 2', 'Evidence attached: a.webm', 'Evidence not attached: b.zip (too big)', 'Not checked before the run: build']) assert.ok(c.includes(part), `missing: ${part}`);
});
await check('comment of a failed run names the failed step and reason', () => {
  const c = buildComment(baseResult({ status: 'FAIL', failedStep: '7. Change a setting', reason: 'expect(x) failed' }), { uploaded: [], skipped: [] });
  assert.ok(c.includes('[FAIL]') && c.includes('Failed step: 7. Change a setting') && c.includes('Reason: expect(x) failed'));
});

// ---- Jira / Xray against the local mock ----
const mock = await startMockXray(2048);
const config: ToolConfig = { jiraBaseUrl: mock.baseUrl, jiraToken: MOCK_TOKEN, testsAssociationField: 'customfield_10715', nakivoBaseUrl: null, port: 4510 };
const auth = { baseUrl: mock.baseUrl, token: MOCK_TOKEN };
try {
  await check('execution is retrieved dynamically with its tests, run ids, statuses and titles', async () => {
    const e = await getExecution(auth, config, MOCK_EXECUTION);
    assert.equal(e.tests.length, 3);
    assert.equal(e.fixVersions[0], 'Mock FV');
    const t = e.tests.find((x) => x.key === 'NJM-187289');
    assert.equal(t?.runId, MOCK_RUN_ID);
    assert.equal(t?.status, 'TODO');
    assert.equal(t?.title, 'Mock case A');
    assert.equal(e.testsSource, 'xray-rest+jira-field');
  });
  await check('read-only mode refuses a write before any request is sent, and still allows reads', async () => {
    const before = mock.requests.length;
    await assert.rejects(() => jiraRequest({ ...auth, readOnly: true }, 'PUT', `/rest/raven/1.0/api/testrun/${MOCK_RUN_ID}`, { json: { status: 'PASS' } }), /Blocked/);
    await assert.rejects(() => jiraRequest({ ...auth, readOnly: true }, 'POST', `/rest/raven/1.0/api/testrun/${MOCK_RUN_ID}/attachment`, { json: {} }), /Blocked/);
    assert.equal(mock.requests.length, before, 'a blocked request reached the server');
    await jiraRequest({ ...auth, readOnly: true }, 'GET', '/rest/api/2/attachment/meta');
    assert.equal(mock.requests.length, before + 1);
  });
  await check('a key that is not an issue key is rejected before any request', async () => {
    const before = mock.requests.length;
    await assert.rejects(() => getExecution(auth, config, 'not a key'), /not an issue key/);
    assert.equal(mock.requests.length, before);
  });
  await check('the token never appears in an error', async () => {
    await assert.rejects(() => getExecution({ baseUrl: mock.baseUrl, token: 'wrong-token-999' }, config, MOCK_EXECUTION), (error: Error) => !error.message.includes('wrong-token-999') && /401/.test(error.message));
  });

  // a run folder with a small video, a screenshot, status.json and a file over the mock's 2048-byte limit
  const rel = 'artifacts/selftest/run1';
  const dir = join(REPO_ROOT, rel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'NJM-187289_PASS_x.webm'), Buffer.alloc(600, 1));
  writeFileSync(join(dir, 'evidence-1.png'), Buffer.alloc(300, 2));
  writeFileSync(join(dir, 'status.json'), '{"status":"PASS"}');
  writeFileSync(join(dir, 'trace.zip'), Buffer.alloc(5000, 3));
  const result = baseResult({ runDir: rel, files: ['evidence-1.png', 'status.json', 'NJM-187289_PASS_x.webm', 'trace.zip'] });

  await check('dry run reads Jira but writes nothing', async () => {
    const before = mock.requests.length;
    const record = await publishResult(config, result, MOCK_EXECUTION, { dryRun: true, testRunId: MOCK_RUN_ID });
    const sent = mock.requests.slice(before);
    assert.ok(sent.every((r) => r.method === 'GET'), 'a dry run sent a write');
    assert.equal(record.statusUpdated, false);
    assert.ok(record.comment.includes('Evidence attached:'));
  });
  await check('publish updates the individual test run, posts the comment and uploads evidence within the limit', async () => {
    const before = mock.requests.length;
    const record = await publishResult(config, result, MOCK_EXECUTION, { dryRun: false, testRunId: MOCK_RUN_ID });
    const sent = mock.requests.slice(before);
    assert.deepEqual(record.errors, []);
    const put = sent.find((r) => r.method === 'PUT');
    assert.equal(put?.path, `/rest/raven/1.0/api/testrun/${MOCK_RUN_ID}`);
    const putBody = put?.body as { status: string; comment: string };
    assert.equal(putBody.status, 'PASS');
    assert.ok(putBody.comment.includes('Scope: Scope line text.'));
    const uploads = sent.filter((r) => r.method === 'POST').map((r) => (r.body as { filename: string }).filename).sort();
    assert.deepEqual(uploads, ['NJM-187289_PASS_x.webm', 'evidence-1.png', 'status.json']);
    const skipped = record.skipped.find((s) => s.name === 'trace.zip');
    assert.ok(skipped && skipped.reason.includes('limit'), 'the oversized trace was not skipped with a reason');
    assert.ok(putBody.comment.includes('Evidence not attached: trace.zip'));
    const body = sent.find((r) => r.method === 'POST')?.body as { data: string };
    assert.ok(Buffer.from(body.data, 'base64').length > 0);
  });
  await check('a retry does not upload the same evidence twice', async () => {
    const before = mock.requests.length;
    await publishResult(config, result, MOCK_EXECUTION, { dryRun: false, testRunId: MOCK_RUN_ID });
    assert.equal(mock.requests.slice(before).filter((r) => r.method === 'POST').length, 0);
  });
  await check('the test run is looked up when its id is not known', async () => {
    const before = mock.requests.length;
    await publishResult(config, result, MOCK_EXECUTION, { dryRun: true });
    assert.ok(mock.requests.slice(before).some((r) => r.path.startsWith('/rest/raven/1.0/api/testrun?testExecIssueKey=TST-1&testIssueKey=NJM-187289')));
  });
  await check('a missing Jira configuration is reported, not thrown, and the result is untouched', async () => {
    const record = await publishResult({ ...config, jiraToken: null }, result, MOCK_EXECUTION, { dryRun: false });
    assert.ok(record.errors[0].includes('JIRA_TOKEN'));
    assert.equal(record.statusUpdated, false);
  });
  await check('every request carried a Bearer token header', () => assert.ok(mock.requests.length > 0 && mock.requests.every((r) => /^Bearer \S+$/.test(String(r.authorization)))));
} finally {
  await mock.close();
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('Failed: ' + failures.join(' | '));
  process.exitCode = 1;
}
