import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, EXISTING_BACKUP_CHECKBOX, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154810: "[DBM-BK-UI-Dest-0015-4] Verify Child DB Expansion".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The expanded child shows its "Destination" combo and "Use an existing backup as a target"
//   (the mapping control); "Select a backup" is enabled only after a destination is chosen (memory note).
// UNVERIFIED: that a child of a ticked item expands the same way as a single ticked database.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO expands a child database row in the container block to show its destination configuration', { tag: '@NJM-154810' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the whole SQL item and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. In Advanced setup expand the container and click a child database: the row expands to show its own destination configuration', async () => {
    await dest.openAdvanced();
    await dest.ensureBlockOpen(source.item);
    await expect(dest.text(EXISTING_BACKUP_CHECKBOX)).toHaveCount(0);
    await dest.toggle(db);
    await expect(dest.rowCombo(db)).toBeVisible();
  });
  await test.step('4. Confirm the expanded child content: its destination and mapping controls are shown', async () => {
    await expect(dest.text(EXISTING_BACKUP_CHECKBOX).first()).toBeVisible();
    await expect(dest.rowCombo(db)).toBeEnabled();
  });
});
