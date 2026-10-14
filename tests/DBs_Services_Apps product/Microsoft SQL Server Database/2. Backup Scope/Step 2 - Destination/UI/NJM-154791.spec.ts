import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, EXISTING_BACKUP_CHECKBOX, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154791: "[DBM-BK-UI-Dest-0005] Verify Advanced Setup Expanded View".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI); the case compares with Figma (not available): the expanded view is checked by its elements.
// case-vs-ui: the expandable entry is the database row; expanding it reveals its Destination combo and "Use an existing backup as a target".
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO expands and collapses a source item in Advanced setup', { tag: '@NJM-154791' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
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
  await test.step('3. Open Advanced setup and expand the item: it shows its destination dropdown', async () => {
    await dest.openAdvanced();
    await dest.toggle(db);
    await expect(dest.rowCombo(db)).toBeVisible();
    await expect(dest.text(EXISTING_BACKUP_CHECKBOX).first()).toBeVisible();
  });
  await test.step('4. Collapse the same item: it collapses back and hides its content', async () => {
    await dest.toggle(db);
    await expect(dest.text(EXISTING_BACKUP_CHECKBOX)).toHaveCount(0);
    await expect(dest.header(db)).toBeVisible();
  });
});
