import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154809: "[DBM-BK-UI-Dest-0015-3] Verify Child Database Display".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_INSTANCE_DB_FULL (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The whole item is ticked; every database of the item is a child row ("Click to expand").
// UNVERIFIED: each child row's own destination control appears once the row is expanded (first input after the row name).
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO lists the selected child databases under the container block, each with its own destination control', { tag: '@NJM-154809' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const children = [readBackupDatabase('INSTANCE', 'SIMPLE'), readBackupDatabase('INSTANCE', 'FULL')];

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the whole SQL item and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. In Advanced setup expand the container block: its child databases are listed beneath it', async () => {
    await dest.openAdvanced();
    await dest.ensureBlockOpen(source.item);
    for (const name of children) await expect(dest.header(name)).toBeVisible();
  });
  await test.step('4. Confirm each child row has its own destination control', async () => {
    for (const name of children) {
      await dest.toggle(name);
      await expect(dest.rowCombo(name), `no destination dropdown in the row of ${name}`).toBeVisible();
    }
  });
});
