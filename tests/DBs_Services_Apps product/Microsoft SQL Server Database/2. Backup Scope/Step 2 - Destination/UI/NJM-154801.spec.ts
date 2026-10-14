import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154801: "[DBM-BK-UI-Dest-0015] Verify Container Block Display".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The whole Inventory item is ticked (a container block exists per ticked item, memory note
//   nakivo-db-backup-job-wizard); the block header shows the item's display name.
// UNVERIFIED: the markup of the block header; the block is found by its text and opened with a click on the header when "Default Destination" is not shown.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO shows a ticked SQL item in Advanced setup as a container block grouping its databases', { tag: '@NJM-154801' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
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
  await test.step('3. Open Advanced setup: the SQL item is its own block grouping its databases', async () => {
    await dest.openAdvanced();
    await dest.ensureBlockOpen(source.item);
    await expect(dest.defaultDestinationLabel()).toBeVisible();
    await expect(dest.header(db)).toBeVisible();
  });
  await test.step('4. Confirm the block header content: it displays the SQL item name', async () => {
    await expect(dest.text(source.item).first()).toBeVisible();
  });
});
