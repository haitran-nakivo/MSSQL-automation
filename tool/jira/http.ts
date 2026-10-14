import type { JiraAuth } from '../config/env.ts';

export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// Removes the token (and the Authorization header form of it) from any text that may be logged or shown.
export function redact(text: string, auth: JiraAuth): string {
  let out = text;
  if (auth.token) out = out.split(auth.token).join('***');
  return out.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer ***');
}

export interface RequestOptions {
  query?: Record<string, string | number | undefined>;
  json?: unknown;
  timeoutMs?: number;
}

// One Jira REST call with the personal access token as a Bearer header. Returns parsed JSON, or text, or null for an empty body.
// Errors carry the status and a short, token-free snippet of the response body.
export async function jiraRequest(auth: JiraAuth, method: string, path: string, options: RequestOptions = {}): Promise<unknown> {
  if (auth.readOnly && method !== 'GET' && !(method === 'POST' && path === '/rest/api/2/search')) {
    throw new HttpError(`Blocked: read-only mode does not allow ${method} ${path}`, 0);
  }
  const url = new URL(auth.baseUrl + path);
  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${auth.token}`, Accept: 'application/json', 'X-Atlassian-Token': 'no-check' };
  if (options.json !== undefined) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.json === undefined ? undefined : JSON.stringify(options.json),
      signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
    });
  } catch (error) {
    throw new HttpError(redact(`Jira ${method} ${path}: ${(error as Error).message}`, auth), 0);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new HttpError(redact(`Jira ${method} ${path} -> HTTP ${response.status}: ${text.slice(0, 300).replace(/\s+/g, ' ')}`, auth), response.status);
  }
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
