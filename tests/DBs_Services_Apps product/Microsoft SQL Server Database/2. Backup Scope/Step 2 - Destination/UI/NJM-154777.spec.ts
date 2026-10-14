import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154777: "[DBM-BK-UI-Dest-0001] Verify Fast Setup Default View".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled; no job is created).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI); the case compares with Figma, which is not available: the layout is checked by its elements.
// Ad hoc (negative): Cancel leaves no job named NJM-154777.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO opens Step 2 of the database backup wizard in Fast setup with one destination dropdown and an Advanced setup link', { tag: '@NJM-154777' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the database and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. Observe the layout: Fast setup with a single destination dropdown for all selected databases', async () => {
    await expect(dest.text(/^Destination:?$/)).toHaveCount(1);
    await expect(dest.fastCombo).toBeVisible();
    await expect(dest.defaultDestinationLabel()).toHaveCount(0);
  });
  await test.step('4. Additional controls: the Advanced setup link is shown and no per-database rows are shown yet', async () => {
    await expect(dest.advancedLink).toBeVisible();
    await expect(dest.header(db)).toHaveCount(0);
    expect(await dest.expandedHintCount()).toBe(0);
  });
  await test.step('Ad hoc (negative): Cancel discards the wizard and no job NJM-154777 exists', async () => {
    await backupFlows.cancelWizard();
    expect(await backupFlows.jobExists('NJM-154777')).toBe(false);
  });
});
