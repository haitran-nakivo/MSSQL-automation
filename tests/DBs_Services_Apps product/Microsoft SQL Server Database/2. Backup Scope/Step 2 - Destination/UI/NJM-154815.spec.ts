import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-154815: "[DBM-BK-UI-Dest-0017] Verify Consistent Configuration".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved (the browser page of the test is discarded with it); no job, Inventory item or repository is touched.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Fast Setup" / "Advanced Setup": the UI has the "Destination:" combo above an "Advanced setup..." link that lists one block per ticked item and one row per database ("Click to expand").
test.use(RUN_OPTIONS);

test('NAKIVO keeps the same destination in the Destination combo and in Advanced setup', { tag: '@NJM-154815' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Fast Setup\" / \"Advanced Setup\": the UI has the \"Destination:\" combo above an \"Advanced setup...\" link that lists one block per ticked item and one row per database (\"Click to expand\")." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  await test.step('1. Open Data Protection, click + and choose Backup for Database: the New Backup Job Wizard for Database opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
    await expect(backupFlows.wizard.selectionSummary).toContainText('Select at least one item');
  });
  await test.step('2. Select one database and click Next: the wizard advances to Step 2 (Destination)', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
    await expect(dest.p.topCombo).toBeVisible();
  });
  await test.step('3. Set a destination in the Destination combo, open Advanced setup, then switch back', async () => {
    await dest.setTopDestination(repo);
    await dest.openAdvancedSetup();
    await dest.ensureExpanded(db1);
    expect(await dest.databaseDestinationValue(db1), 'Advanced setup does not show the destination set above').toContain(repo);
    const switched = await dest.closeAdvancedSetup();
    testInfo.annotations.push({ type: 'observed-outcome', description: 'A "Fast setup" link to switch back from Advanced setup was ' + (switched ? 'found and used' : 'not found; the step tabs were used to leave and re-enter Step 2') });
    if (!switched) {
      await dest.goToSource();
      await dest.goToDestination();
    }
  });
  await test.step('4. Confirm the value shown in both views: the same repository is the destination', async () => {
    expect(await dest.topDestinationValue()).toContain(repo);
    await dest.openAdvancedSetup();
    expect(await dest.databaseDestinationValue(db1)).toContain(repo);
  });
});
