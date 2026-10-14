import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-154827: "[DBM-BK-UI-Dest-0017-3-3] Verify Target Backup List".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved (the browser page of the test is discarded with it); no job, Inventory item or repository is touched.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Fast Setup" / "Advanced Setup": the UI has the "Destination:" combo above an "Advanced setup..." link that lists one block per ticked item and one row per database ("Click to expand").
// case-vs-ui: the case calls the control "Use existing backup" with a "Target backup" dropdown; the UI label is "Use an existing backup as a target" and the combo shows "Select a backup".
// case-vs-ui: a backup used by a live job cannot be chosen: the UI answers with the "Cannot use the backup" pop-up (Observed); a free one asks "Use this backup as target?".
test.use(RUN_OPTIONS);

test('NAKIVO lists the existing backups of the selected repository and lets the user pick one', { tag: '@NJM-154827' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Fast Setup\" / \"Advanced Setup\": the UI has the \"Destination:\" combo above an \"Advanced setup...\" link that lists one block per ticked item and one row per database (\"Click to expand\"). | the case calls the control \"Use existing backup\" with a \"Target backup\" dropdown; the UI label is \"Use an existing backup as a target\" and the combo shows \"Select a backup\". | a backup used by a live job cannot be chosen: the UI answers with the \"Cannot use the backup\" pop-up (Observed); a free one asks \"Use this backup as target?\"." });
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
  await test.step('3. With a repository selected and the checkbox checked open the backup dropdown: the existing backups of the repository are listed', async () => {
    await dest.openAdvancedSetup();
    await dest.setDatabaseDestination(db1, repo);
    await dest.tickUseExisting(db1);
    const texts = await dest.openBackupList(db1);
    if (texts.length === 0) throw new Error('ABORTED: the repository ' + repo + ' holds no backup to list; run a backup job into it first');
    testInfo.annotations.push({ type: 'observed-outcome', description: 'backup list texts: ' + JSON.stringify(texts) });
    expect(texts.length).toBeGreaterThan(0);
    await dest.closeList(db1);
  });
  await test.step('4. Select an existing backup from the list: the chosen backup is set as the target for the database', async () => {
    const chosen = await dest.selectFreeBackup(db1);
    if (chosen === null) throw new Error('ABORTED: every tried backup in ' + repo + ' is used by a live job (the Director refuses it); a free backup is needed');
    expect(await dest.backupComboValue(db1), 'the chosen backup is not shown in the dropdown').not.toBe('');
  });
});
