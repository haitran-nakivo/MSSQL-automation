import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154766: "[DBM-BK-UI-Source-Left Pane-0019-7] Verify Alert Hides on Deselect".
// Env (.env, owner-supplied): NAKIVO_BK_LICENSE_REMAINDER_1 = 1 (the owner confirms that exactly ONE database license is left; the test also checks the label), NAKIVO_BK_LICENSE_DB_1 and
//   NAKIVO_BK_LICENSE_DB_2 = two distinct databases listed in the source tree. Missing / other value: ABORTED. Never changes licensing.
// Side effects: none (opens the wizard and cancels it).
// UNVERIFIED: alert wording is the case's ("Not enough licenses to proceed"); the label wording "N databases remaining" is the case's.
test.use(RUN_OPTIONS);

test('NAKIVO hides the "Not enough licenses" alert as soon as the selection fits the remaining licenses again', { tag: '@NJM-154766' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const remainder = readBackupValue('LICENSE_REMAINDER_1');
  const db1 = readBackupValue('LICENSE_DB_1');
  const db2 = readBackupValue('LICENSE_DB_2');
  if (remainder !== '1') throw new Error(`ABORTED: NAKIVO_BK_LICENSE_REMAINDER_1 must be 1 (got "${remainder}")`);

  await test.step('1. Precondition and 2. open the wizard: exactly one database license remains', async () => {
    await flows.openStep1();
    const left = await flows.readRemainingDatabases();
    if (left !== 1) throw new Error(`ABORTED: the license label shows ${left ?? 'no counter'} databases remaining, the case needs exactly 1`);
  });

  await test.step('3. Select two databases: the "Not enough licenses" alert is displayed', async () => {
    await flows.clickCheckbox(db1);
    await flows.clickCheckbox(db2);
    await expect(flows.sources.licenseAlert()).toBeVisible({ timeout: 10_000 });
  });

  await test.step('4. Deselect one database: the alert disappears immediately', async () => {
    await flows.clickCheckbox(db2);
    await expect(flows.sources.licenseAlert()).toBeHidden({ timeout: 5_000 });
    expect(await flows.isChecked(db1)).toBe(true);
    expect(await flows.isChecked(db2)).toBe(false);
  });

  await test.step('Ad hoc: selecting the second database again brings the alert back', async () => {
    await flows.clickCheckbox(db2);
    await expect(flows.sources.licenseAlert()).toBeVisible({ timeout: 10_000 });
  });

  await flows.leaveWizard();
});
