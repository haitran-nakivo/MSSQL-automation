import type { Locator } from '@playwright/test';

// Typing helpers for the Options-step text-rule specs (NJM-1545xx / 1546xx / 1596xx). Same rules as flows/wizard.flows.ts
// (standards/flows-layer.md): no assertions, no .env, only key input with the short delay the form controls need.

const KEY_DELAY_MS = 80;

// Replaces the whole value of a field by typing, then leaves it with Tab (the validation runs on leave).
export async function replaceValue(field: Locator, value: string): Promise<void> {
  await field.click({ timeout: 10_000 });
  await field.press('Control+A');
  await field.pressSequentially(value, { delay: KEY_DELAY_MS });
  await field.press('Tab');
}

// Types extra text at the end of a field's current value, then leaves it with Tab.
export async function appendValue(field: Locator, text: string): Promise<void> {
  await field.click({ timeout: 10_000 });
  await field.press('End');
  await field.pressSequentially(text, { delay: KEY_DELAY_MS });
  await field.press('Tab');
}

// Clicks the right edge of a field (where a show-password toggle would sit) and reports the input type afterwards.
export async function clickRightEdgeAndReadType(field: Locator): Promise<string | null> {
  const box = await field.boundingBox({ timeout: 10_000 });
  if (!box) return null;
  await field.click({ position: { x: Math.max(1, box.width - 6), y: Math.max(1, box.height / 2) }, timeout: 10_000 });
  return field.getAttribute('type');
}
