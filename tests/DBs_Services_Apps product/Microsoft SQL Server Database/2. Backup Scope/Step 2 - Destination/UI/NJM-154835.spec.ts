import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-154835: "[DBM-BK-UI-Dest-0018] Verify Empty Source Handling".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved (the browser page of the test is discarded with it); no job, Inventory item or repository is touched.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case title says a text "Select at least one source item..." appears when the Source is emptied; in the UI that text ("Select at least one item on the left") is on the Source step, and the Destination step cannot be reached with nothing selected (Observed: Next stays on the step). The spec asserts that.
test.use(RUN_OPTIONS);

test('NAKIVO blocks Next while no source is selected and keeps the Destination step usable after the selection is emptied', { tag: '@NJM-154835' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case title says a text \"Select at least one source item...\" appears when the Source is emptied; in the UI that text (\"Select at least one item on the left\") is on the Source step, and the Destination step cannot be reached with nothing selected (Observed: Next stays on the step). The spec asserts that." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  await test.step('1. Open Data Protection, click + and choose Backup for Database: the wizard opens at Step 1 (Source) with nothing selected', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.selectionSummary).toContainText('Select at least one item');
  });
  await test.step('2. Click Next with nothing selected: the wizard stays on Step 1 and still asks for at least one item', async () => {
    await backupFlows.next({ blocked: true });
    await expect(backupFlows.wizard.selectionSummary).toContainText('Select at least one item');
    await expect(backupFlows.wizard.advancedSetupLink).toBeHidden();
  });
  await test.step('3. Select a database, reach Step 2, return to Step 1 and clear the selection: the empty-selection text is shown again and Next does not advance', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
    await dest.goToSource();
    await dest.toggleDatabase(source.item, db1);
    await expect(backupFlows.wizard.selectionSummary).toContainText('Select at least one item');
    await backupFlows.next({ blocked: true });
    await expect(backupFlows.wizard.selectionSummary).toContainText('Select at least one item');
  });
  await test.step('4. Select the database again: Next works and the Destination step lists it without errors', async () => {
    await dest.toggleDatabase(source.item, db1);
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
    await dest.openAdvancedSetup();
    await expect(dest.p.dbName(db1)).toBeVisible();
  });
});
