import type { RunResult } from '../runner/run-case.ts';

// The comment written to the individual Xray test run. Its scope line comes from the case data, so a PASS can never read as more
// than was checked: an adjusted case says what the current NBR UI could not show.

const duration = (ms: number): string => {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

export interface EvidenceNotes {
  uploaded: string[];
  skipped: { name: string; reason: string }[];
}

export function buildComment(result: RunResult, evidence: EvidenceNotes): string {
  const lines: string[] = [];
  lines.push(`[${result.status}] ${result.key}${result.title ? ` - ${result.title}` : ''}`);
  const s = result.settings;
  lines.push(
    [
      `Build: ${s.build || 'not set'}`,
      `Fix Version: ${s.fixVersion || 'not set'}`,
      `Tenancy: ${s.tenancy || 'not set'}`,
      `Duration: ${duration(result.durationMs)}`,
      `Started: ${result.startedAt}`,
    ].join(' | '),
  );
  if (result.scopeLine) lines.push(`Scope: ${result.scopeLine}`);
  if (result.notVerified && !(result.scopeLine ?? '').includes('Not verified')) lines.push(`Not verified: ${result.notVerified}`);
  if (result.steps.length > 0) {
    const ok = result.steps.filter((step) => step.ok).length;
    lines.push(`Steps: ${ok} of ${result.steps.length} passed`);
  }
  if (result.status !== 'PASS') {
    if (result.failedStep) lines.push(`Failed step: ${result.failedStep}`);
    if (result.reason) lines.push(`Reason: ${result.reason}`);
  }
  const skippedChecks = result.preflight.filter((c) => c.status === 'skipped');
  if (skippedChecks.length > 0) lines.push(`Not checked before the run: ${skippedChecks.map((c) => `${c.id} (${c.detail})`).join('; ')}`);
  if (evidence.uploaded.length > 0) lines.push(`Evidence attached: ${evidence.uploaded.join(', ')}`);
  for (const item of evidence.skipped) lines.push(`Evidence not attached: ${item.name} (${item.reason})`);
  lines.push(`Run ${result.runId}, evidence folder ${result.runDir}. Executed by the automation tool; no AI took part in the run.`);
  return lines.join('\n');
}
