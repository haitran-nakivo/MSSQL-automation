import { test } from '@playwright/test';
import { STEP_DELAY_MS } from '../fixtures/run-options';

// The one viewing pause (owner request, 2026-10-13): lets a watcher and the recorded video see a screen for STEP_DELAY_MS.
// Used by fixtures/index.ts after each test.step and by the shared flows after each wizard Next that moved. Specs never call it.
// It is a deliberate delay, not a synchronization wait: nothing may depend on it. STEP_DELAY_MS = 0 turns it off.
//
// Timeout: every pause adds its length to the test timeout, so it never uses up a spec's budget. The total added so far is kept per
// test attempt, and fixtures/index.ts wraps test.setTimeout() with withPausedTime(), so a spec that sets its timeout after some
// pauses (test.setTimeout(600_000) in the middle of a test) still gets the pauses on top of what it asked for.
const pausedByAttempt = new Map<string, number>();

function attemptKey(): string | undefined {
  try {
    const info = test.info();
    return `${info.testId}#${info.retry}`;
  } catch {
    return undefined; // outside a running test (a script, a worker fixture)
  }
}

// Time this attempt has paused so far (0 outside a test).
export function pausedMs(): number {
  const key = attemptKey();
  return key ? (pausedByAttempt.get(key) ?? 0) : 0;
}

// A timeout the spec asked for, plus the pauses already taken. 0 stays 0 (no limit).
export function withPausedTime(timeout: number): number {
  return timeout > 0 ? timeout + pausedMs() : timeout;
}

export async function viewingPause(): Promise<void> {
  if (STEP_DELAY_MS <= 0) return;
  const key = attemptKey();
  if (key) {
    const info = test.info();
    if (info.timeout > 0) {
      info.setTimeout(info.timeout + STEP_DELAY_MS); // timeout 0 means "no limit": leave it alone
      pausedByAttempt.set(key, (pausedByAttempt.get(key) ?? 0) + STEP_DELAY_MS);
    }
  }
  await new Promise((resolve) => setTimeout(resolve, STEP_DELAY_MS));
}
