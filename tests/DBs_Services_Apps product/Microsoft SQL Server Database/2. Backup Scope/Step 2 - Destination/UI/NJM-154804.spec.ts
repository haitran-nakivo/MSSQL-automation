import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154804: "[DBM-BK-UI-Dest-0015-2] Verify Default Destination Dropdown".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The whole item is ticked so that a container block exists. The "scope" is checked as one
//   "Default Destination" per ticked item, none per database row; the wording of the scope is in the tooltip (NJM-154808).
// UNVERIFIED: the label is "Default Destination" (memory note) and the combo is the first input after it.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO shows a Default Destination dropdown in the container block of Advanced setup', { tag: '@NJM-154804' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the whole SQL item and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. Open Advanced setup and inspect the container block header: a Default Destination dropdown is present', async () => {
    await dest.openAdvanced();
    await dest.ensureBlockOpen(source.item);
    await expect(dest.defaultDestinationLabel()).toBeVisible();
    await expect(dest.defaultDestinationCombo()).toBeVisible();
  });
  await test.step('4. Confirm the scope: one default dropdown for the whole container, not one per database', async () => {
    await expect(dest.defaultDestinationLabel()).toHaveCount(1);
  });
});
