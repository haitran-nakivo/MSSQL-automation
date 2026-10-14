import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154769: "[DBM-BK-UI-Source-Left Pane-0019-10] Verify 'Databases Remaining' Format".
// Env (.env, owner-supplied): NAKIVO_BK_LICENSE_DB_REMAINING = the "databases remaining" count the license label shows with nothing selected (a per-database license is applied now).
//   Missing value: ABORTED ("Missing in .env"). The test never changes licensing.
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the wording "License: X databases remaining" is the case's; matched as /License:\s*(\d+) databases remaining/i.
// UNVERIFIED: the license label markup and wording were never inspected live.
test.use(RUN_OPTIONS);

test('NAKIVO shows "License: X databases remaining" in the Step 1 label for a per-database license', { tag: '@NJM-154769' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const remaining = Number(readBackupValue('LICENSE_DB_REMAINING'));
  if (!Number.isInteger(remaining) || remaining < 0) throw new Error(`ABORTED: NAKIVO_BK_LICENSE_DB_REMAINING must be a whole number (got "${remaining}")`);

  await test.step('1. Precondition: a per-database license is applied (value from .env)', async () => {
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  await test.step('2. Open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Observe the license label in the right-pane footer: it is visible', async () => {
    const label = await flows.readLicenseLabel();
    testInfo.annotations.push({ type: 'observed-outcome', description: `license label: "${label.text}"` });
    expect(label.text).toMatch(/licen[sc]e/i);
  });

  await test.step('4. Read the remaining-count text: it matches "License: X databases remaining" with the licensed count', async () => {
    const label = await flows.readLicenseLabel();
    const match = /License:\s*(\d+)\s+databases?\s+remaining/i.exec(label.text);
    expect(match, `label "${label.text}" does not match "License: X databases remaining"`).not.toBeNull();
    expect(Number(match?.[1])).toBe(remaining);
  });

  await flows.leaveWizard();
});
