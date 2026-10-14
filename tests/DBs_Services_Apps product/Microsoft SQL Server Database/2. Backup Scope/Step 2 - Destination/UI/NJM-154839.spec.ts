import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-154839: "[DBM-BK-UI-Dest-0022] Verify Order Update".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_INSTANCE_DB_FULL (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved (the browser page of the test is discarded with it); no job, Inventory item or repository is touched.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: "change the selection order" is done by unticking and ticking the first database again (it then becomes last); dragging in the "Drag items to set processing priority" list was not automated (Ext drag, not seen live).
test.use(RUN_OPTIONS);

test('NAKIVO updates the order of the destination items when the selection order changes in Step 1', { tag: '@NJM-154839' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | \"change the selection order\" is done by unticking and ticking the first database again (it then becomes last); dragging in the \"Drag items to set processing priority\" list was not automated (Ext drag, not seen live)." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const db2 = readBackupDatabase('INSTANCE', 'FULL');
  await test.step('1. Open Data Protection, click + and choose Backup for Database: the New Backup Job Wizard for Database opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
    await expect(backupFlows.wizard.selectionSummary).toContainText('Select at least one item');
  });
  await test.step('2. Select two databases and click Next: the wizard advances to Step 2 (Destination)', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db1, db2] }]);
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
    await expect(dest.p.topCombo).toBeVisible();
  });
  const PRIORITY_ANCHOR = 'Drag items to set processing priority';
  await test.step('3. Return to Step 1 and change the selection order, then go back to Step 2: the destination order matches the new Step 1 order', async () => {
    await dest.openAdvancedSetup();
    expect(await dest.verticalOrder([db1, db2]), 'initial destination order').toEqual([db1, db2]);
    await dest.goToSource();
    await dest.toggleDatabase(source.item, db1);
    await dest.toggleDatabase(source.item, db1);
    expect(await dest.verticalOrder([db1, db2], PRIORITY_ANCHOR), 'Step 1 order after re-ticking the first database').toEqual([db2, db1]);
    await dest.goToDestination();
    await dest.openAdvancedSetup();
  });
  await test.step('4. Confirm the resulting order: the destination items are ordered like the reordered Step 1 selection', async () => {
    expect(await dest.verticalOrder([db1, db2]), 'destination order after the change').toEqual([db2, db1]);
  });
});
