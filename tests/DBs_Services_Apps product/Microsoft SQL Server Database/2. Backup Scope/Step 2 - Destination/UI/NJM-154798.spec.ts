import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, EXISTING_BACKUP_CHECKBOX, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154798: "[DBM-BK-UI-Dest-0012] Verify Item Collapse".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The collapsible item is the database row; the indicator is checked as "the expand hint count is back to its initial value".
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO collapses an expanded Advanced setup item and hides its content', { tag: '@NJM-154798' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  let hintsCollapsed = 0;

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the database and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. In Advanced setup expand the item, then click its header: the item collapses and hides its content', async () => {
    await dest.openAdvanced();
    hintsCollapsed = await dest.expandedHintCount();
    await dest.toggle(db);
    await expect(dest.text(EXISTING_BACKUP_CHECKBOX).first()).toBeVisible();
    await dest.toggle(db);
    await expect(dest.text(EXISTING_BACKUP_CHECKBOX)).toHaveCount(0);
  });
  await test.step('4. Confirm the indicator reflects the collapsed state', async () => {
    expect(await dest.expandedHintCount()).toBe(hintsCollapsed);
  });
});
