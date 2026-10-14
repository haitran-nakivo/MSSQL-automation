import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154765: "[DBM-BK-UI-Source-Left Pane-0019-6] Verify License Exceeded Alert".
// Env (.env, owner-supplied): NAKIVO_BK_LICENSE_REMAINDER_1 = 1 (the owner confirms that exactly ONE database license is left on the Director; the test also checks the label shows
//   "1 databases remaining"), NAKIVO_BK_LICENSE_DB_1 and NAKIVO_BK_LICENSE_DB_2 = two distinct databases listed in the source tree. Missing / other value: ABORTED. Never changes licensing.
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the case says the alert is "un-dismissible": asserted as "the alert offers no close control" (UNVERIFIED markup, see flows).
// case-vs-ui: the case's step 3 expects "0 remaining" after the first database: asserted from the label.
// UNVERIFIED: alert wording is the case's: "Not enough licenses to proceed. Contact Sales to obtain more licenses."
test.use(RUN_OPTIONS);

test('NAKIVO shows a "Not enough licenses" alert when more databases are selected than licenses remain', { tag: '@NJM-154765' }, async ({ signedIn: _s, page }, testInfo) => {
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
    await expect(flows.sources.licenseAlert()).toBeHidden();
  });

  await test.step('3. Select one database: the selection is accepted, 0 remain and no alert is shown', async () => {
    await flows.clickCheckbox(db1);
    await expect.poll(() => flows.isChecked(db1), { timeout: 10_000 }).toBe(true);
    await expect.poll(() => flows.readRemainingDatabases(), { timeout: 10_000 }).toBe(0);
    await expect(flows.sources.licenseAlert()).toBeHidden();
  });

  await test.step('4. Select a second database, exceeding the limit: the "Not enough licenses" alert appears', async () => {
    await flows.clickCheckbox(db2);
    await expect(flows.sources.licenseAlert()).toBeVisible({ timeout: 10_000 });
    await expect(flows.sources.licenseAlert()).toContainText(/Not enough licenses to proceed/i);
    const text = await flows.sources.licenseAlert().innerText();
    testInfo.annotations.push({ type: 'observed-outcome', description: `alert text: "${text.replace(/\s+/g, ' ')}"` });
    expect(text).toMatch(/Contact Sales/i);
  });

  await test.step('Ad hoc: the alert cannot be dismissed (no close control)', async () => {
    expect(await flows.alertHasCloseControl()).toBe(false);
    await expect(flows.sources.licenseAlert()).toBeVisible();
  });

  await flows.leaveWizard();
});
