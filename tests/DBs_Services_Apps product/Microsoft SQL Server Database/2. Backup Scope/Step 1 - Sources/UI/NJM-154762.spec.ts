import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154762: "[DBM-BK-UI-Source-Left Pane-0019-4] Verify Dynamic Counter Update".
// Env (.env, owner-supplied): NAKIVO_BK_LICENSE_DB_REMAINING = the "databases remaining" count the license label shows when the wizard opens with nothing selected (a per-database license,
//   the case uses a limit of 10); NAKIVO_BK_LICENSE_DB_1 and NAKIVO_BK_LICENSE_DB_2 = two databases (distinct names) listed in the source tree. Missing value: ABORTED ("Missing in .env").
//   The test never changes licensing.
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the case's expected results are internally inconsistent (initial "9 remaining", then "9 remaining" after one selection, "8" after two). The test asserts the stated rule
//   "the counter decreases by one per selected database": N, N-1, N-2, where N is the env value.
// UNVERIFIED: the license label wording "N databases remaining" comes from the case (NJM-154769); never seen live.
test.use(RUN_OPTIONS);

test('NAKIVO updates the "databases remaining" counter of the license label as databases are selected', { tag: '@NJM-154762' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const start = Number(readBackupValue('LICENSE_DB_REMAINING'));
  const db1 = readBackupValue('LICENSE_DB_1');
  const db2 = readBackupValue('LICENSE_DB_2');
  if (!Number.isInteger(start) || start < 2) throw new Error(`ABORTED: NAKIVO_BK_LICENSE_DB_REMAINING must be a whole number of at least 2 (got "${start}")`);

  await test.step('1. Precondition and 2. open the wizard on Step 1 (a per-database license is applied, value from .env)', async () => {
    await flows.openStep1();
  });

  await test.step('3. Note the initial "databases remaining" counter: it equals the license value from .env', async () => {
    expect(await flows.readRemainingDatabases(), 'the label shows no "N databases remaining" counter').toBe(start);
  });

  await test.step('4. Select one database: the counter decreases by one', async () => {
    await flows.clickCheckbox(db1);
    await expect.poll(() => flows.readRemainingDatabases(), { timeout: 10_000 }).toBe(start - 1);
  });

  await test.step('5. Select a second database: the counter decreases again', async () => {
    await flows.clickCheckbox(db2);
    await expect.poll(() => flows.readRemainingDatabases(), { timeout: 10_000 }).toBe(start - 2);
  });

  await test.step('Ad hoc (negative): deselecting a database raises the counter again', async () => {
    await flows.clickCheckbox(db2);
    await expect.poll(() => flows.readRemainingDatabases(), { timeout: 10_000 }).toBe(start - 1);
  });

  await flows.leaveWizard();
});
