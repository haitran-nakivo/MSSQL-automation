import { resolve } from 'node:path';

// Configuration of the automation tool. Read from the repository-root .env (gitignored) and the process environment.
// The tool layer has its own reader on purpose: helpers/credentials.ts belongs to the Playwright layers and is CommonJS
// (uses __dirname), which cannot be loaded by Node's TypeScript runner.
export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

export interface ToolConfig {
  // Jira / Xray. Both are required for anything that talks to Jira; the tool still starts without them.
  jiraBaseUrl: string | null;
  jiraToken: string | null;
  // Field holding "Tests association with a Test Execution" ([{b: testKey, c: testRunId}]). customfield_10715 on this Jira.
  testsAssociationField: string;
  // Director under test (same variable the Playwright layers use).
  nakivoBaseUrl: string | null;
  port: number;
}

export function loadToolConfig(): ToolConfig {
  try {
    process.loadEnvFile(resolve(REPO_ROOT, '.env'));
  } catch {
    // No .env: the process environment alone is used.
  }
  const url = (value: string | undefined): string | null => (value ? value.replace(/\/+$/, '') : null);
  const port = Number(process.env.QA_TOOL_PORT ?? 4510);
  return {
    jiraBaseUrl: url(process.env.JIRA_BASE_URL),
    jiraToken: process.env.JIRA_TOKEN || null,
    testsAssociationField: process.env.JIRA_TESTS_ASSOCIATION_FIELD || 'customfield_10715',
    nakivoBaseUrl: url(process.env.NAKIVO_BASE_URL),
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 4510,
  };
}

export interface JiraAuth {
  baseUrl: string;
  token: string;
  // When true, every request that is not a GET (or the read-only JQL search) is refused before it is sent. Used for dry runs.
  readOnly?: boolean;
}

// Throws a message that names the missing variables, never a value.
export function requireJira(config: ToolConfig): JiraAuth {
  const missing: string[] = [];
  if (!config.jiraBaseUrl) missing.push('JIRA_BASE_URL');
  if (!config.jiraToken) missing.push('JIRA_TOKEN');
  if (missing.length > 0) throw new Error(`Missing in .env at the repository root: ${missing.join(', ')}`);
  return { baseUrl: config.jiraBaseUrl as string, token: config.jiraToken as string };
}
