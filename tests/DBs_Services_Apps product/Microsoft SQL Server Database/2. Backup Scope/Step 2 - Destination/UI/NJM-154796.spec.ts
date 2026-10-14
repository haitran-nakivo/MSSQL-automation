import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, EXISTING_BACKUP_CHECKBOX, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154796: "[DBM-BK-UI-Dest-0010] Verify Default Collapsed State".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_INSTANCE_DB_FULL (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). Two databases are selected so that "all items" is more than one.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO shows all Advanced setup items collapsed by default', { tag: '@NJM-154796' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const selected = [readBackupDatabase('INSTANCE', 'SIMPLE'), readBackupDatabase('INSTANCE', 'FULL')];

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick two databases and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: selected }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. Open Advanced setup and observe the initial state: all items are collapsed', async () => {
    await dest.openAdvanced();
    for (const name of selected) await expect(dest.header(name)).toBeVisible();
    expect(await dest.expandedHintCount()).toBe(selected.length);
  });
  await test.step('4. Confirm no child content is visible initially', async () => {
    await expect(dest.text(EXISTING_BACKUP_CHECKBOX)).toHaveCount(0);
    await expect(dest.text('Select a backup')).toHaveCount(0);
  });
});
