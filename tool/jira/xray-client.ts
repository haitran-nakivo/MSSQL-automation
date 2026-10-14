import type { JiraAuth, ToolConfig } from '../config/env.ts';
import { HttpError, jiraRequest } from './http.ts';
import type { EvidenceFile, Execution, ExecutionTest, TestRunInfo } from './types.ts';

// Xray (Server/Data Center) REST API v1 plus the Jira core REST API.
//
// Confirmed on this Jira by read-only calls (2026-10-09): the core issue API, JQL search, and the field
// "Tests association with a Test Execution" (customfield_10715 = [{b: testKey, c: testRunId}]), which gives the tests of an
// execution and their test-run ids without any Xray endpoint.
//
// NOT yet verified on this Jira (taken from Xray's public REST documentation; see the verification plan): every
// /rest/raven/1.0/ call below. The tool treats a failure of these calls as a reportable error, never as a test result.
//   GET  /rest/raven/1.0/api/testexec/{key}/test              tests of an execution with their current status
//   GET  /rest/raven/1.0/api/testrun?testExecIssueKey=&testIssueKey=   one test run (the individual execution record)
//   GET  /rest/raven/1.0/api/testrun/{id}
//   PUT  /rest/raven/1.0/api/testrun/{id}                      {status, comment}
//   POST /rest/raven/1.0/api/testrun/{id}/attachment           {data (base64), filename, contentType}
//   GET  /rest/api/2/attachment/meta                           {enabled, uploadLimit} (Jira attachment size limit)

const KEY_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/;
export const isIssueKey = (value: string): boolean => KEY_PATTERN.test(value);

interface Issue {
  key: string;
  fields: Record<string, unknown>;
}

const named = (value: unknown): string => (value && typeof value === 'object' && 'name' in value ? String((value as { name: unknown }).name) : '');

async function getIssue(auth: JiraAuth, key: string, fields: string[]): Promise<Issue> {
  return (await jiraRequest(auth, 'GET', `/rest/api/2/issue/${encodeURIComponent(key)}`, { query: { fields: fields.join(',') } })) as Issue;
}

// Summaries of many issues in as few calls as possible (JQL "key in (...)", 100 per call).
async function getSummaries(auth: JiraAuth, keys: string[]): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    const result = (await jiraRequest(auth, 'POST', '/rest/api/2/search', {
      json: { jql: `key in (${chunk.join(',')})`, fields: ['summary'], maxResults: 100 },
    })) as { issues?: Issue[] };
    for (const issue of result.issues ?? []) titles.set(issue.key, String(issue.fields.summary ?? ''));
  }
  return titles;
}

interface XrayListItem {
  key?: string;
  status?: string;
}

async function getXrayTestList(auth: JiraAuth, executionKey: string): Promise<XrayListItem[]> {
  const items: XrayListItem[] = [];
  const limit = 100;
  for (let page = 1; page <= 50; page++) {
    const batch = (await jiraRequest(auth, 'GET', `/rest/raven/1.0/api/testexec/${encodeURIComponent(executionKey)}/test`, { query: { limit, page } })) as XrayListItem[];
    if (!Array.isArray(batch)) throw new Error('Unexpected response from the Xray test list (not a list)');
    items.push(...batch);
    if (batch.length < limit) break;
  }
  return items;
}

// A Test Execution with its tests. Nothing is cached and nothing is hardcoded: the list is whatever Jira holds right now.
export async function getExecution(auth: JiraAuth, config: ToolConfig, executionKey: string): Promise<Execution> {
  if (!isIssueKey(executionKey)) throw new Error(`"${executionKey}" is not an issue key (expected something like NJM-183419)`);
  const field = config.testsAssociationField;
  const issue = await getIssue(auth, executionKey, ['summary', 'status', 'issuetype', 'fixVersions', 'labels', field]);

  // Source 1 (confirmed): the association field gives test keys and test-run ids.
  const association = issue.fields[field];
  const fromField = new Map<string, number>();
  if (Array.isArray(association)) {
    for (const entry of association as { b?: unknown; c?: unknown }[]) {
      if (typeof entry.b === 'string' && typeof entry.c === 'number') fromField.set(entry.b, entry.c);
    }
  }
  // Source 2 (documented, unverified): Xray's own list, which adds the current status of each run.
  const statuses = new Map<string, string>();
  let xrayOk = false;
  try {
    for (const item of await getXrayTestList(auth, executionKey)) {
      if (item.key) statuses.set(item.key, String(item.status ?? ''));
    }
    xrayOk = true;
  } catch {
    // The field alone is enough to list the tests; statuses stay unknown.
  }
  const keys = new Set<string>([...fromField.keys(), ...statuses.keys()]);
  if (keys.size === 0) throw new Error(`No tests were found for ${executionKey} (is it a Test Execution?)`);
  const titles = await getSummaries(auth, [...keys]);
  const tests: ExecutionTest[] = [...keys].map((key) => ({ key, runId: fromField.get(key) ?? null, status: statuses.get(key) ?? null, title: titles.get(key) ?? '' }));
  return {
    key: issue.key,
    summary: String(issue.fields.summary ?? ''),
    issueType: named(issue.fields.issuetype),
    issueStatus: named(issue.fields.status),
    fixVersions: Array.isArray(issue.fields.fixVersions) ? (issue.fields.fixVersions as unknown[]).map(named).filter(Boolean) : [],
    labels: Array.isArray(issue.fields.labels) ? (issue.fields.labels as unknown[]).map(String) : [],
    tests,
    testsSource: xrayOk && fromField.size > 0 ? 'xray-rest+jira-field' : xrayOk ? 'xray-rest' : 'jira-field',
  };
}

// The individual test run (one test inside one execution): the record whose status, comment and evidence the tool updates.
export async function getTestRun(auth: JiraAuth, executionKey: string, testKey: string): Promise<TestRunInfo> {
  const run = (await jiraRequest(auth, 'GET', '/rest/raven/1.0/api/testrun', { query: { testExecIssueKey: executionKey, testIssueKey: testKey } })) as { id?: number; status?: string };
  if (typeof run?.id !== 'number') throw new Error(`Xray returned no test run for ${testKey} in ${executionKey}`);
  return { id: run.id, status: run.status ?? null };
}

export async function getTestRunById(auth: JiraAuth, runId: number): Promise<TestRunInfo> {
  const run = (await jiraRequest(auth, 'GET', `/rest/raven/1.0/api/testrun/${runId}`)) as { id?: number; status?: string };
  if (typeof run?.id !== 'number') throw new Error(`Xray returned no test run with id ${runId}`);
  return { id: run.id, status: run.status ?? null };
}

export async function updateTestRun(auth: JiraAuth, runId: number, update: { status: string; comment: string }): Promise<void> {
  await jiraRequest(auth, 'PUT', `/rest/raven/1.0/api/testrun/${runId}`, { json: { status: update.status, comment: update.comment } });
}

export async function addEvidence(auth: JiraAuth, runId: number, file: EvidenceFile): Promise<void> {
  await jiraRequest(auth, 'POST', `/rest/raven/1.0/api/testrun/${runId}/attachment`, {
    json: { data: file.data.toString('base64'), filename: file.filename, contentType: file.contentType },
    timeoutMs: 300_000,
  });
}

// Jira's attachment size limit in bytes. Falls back to Jira's default (10 MB) when it cannot be read; the result says which.
export async function getAttachmentLimit(auth: JiraAuth): Promise<{ bytes: number; source: 'jira' | 'default' }> {
  try {
    const meta = (await jiraRequest(auth, 'GET', '/rest/api/2/attachment/meta')) as { enabled?: boolean; uploadLimit?: number };
    if (meta.enabled === false) return { bytes: 0, source: 'jira' };
    if (typeof meta.uploadLimit === 'number' && meta.uploadLimit > 0) return { bytes: meta.uploadLimit, source: 'jira' };
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
  }
  return { bytes: 10 * 1024 * 1024, source: 'default' };
}
