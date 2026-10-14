import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-154826: "[DBM-BK-UI-Dest-0017-3-2] Verify Target Backup Enabled State".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved (the browser page of the test is discarded with it); no job, Inventory item or repository is touched.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Fast Setup" / "Advanced Setup": the UI has the "Destination:" combo above an "Advanced setup..." link that lists one block per ticked item and one row per database ("Click to expand").
// case-vs-ui: the case calls the control "Use existing backup" with a "Target backup" dropdown; the UI label is "Use an existing backup as a target" and the combo shows "Select a backup".
test.use(RUN_OPTIONS);

test('NAKIVO enables the \'Select a backup\' dropdown when the existing-backup checkbox is checked', { tag: '@NJM-154826' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Fast Setup\" / \"Advanced Setup\": the UI has the \"Destination:\" combo above an \"Advanced setup...\" link that lists one block per ticked item and one row per database (\"Click to expand\"). | the case calls the control \"Use existing backup\" with a \"Target backup\" dropdown; the UI label is \"Use an existing backup as a target\" and the combo shows \"Select a backup\"." });
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
  await test.step('3. Check the existing-backup checkbox: the backup dropdown becomes enabled', async () => {
    await dest.openAdvancedSetup();
    await dest.setDatabaseDestination(db1, repo);
    await dest.tickUseExisting(db1);
    expect((await dest.backupComboState(db1)).disabled, 'the backup dropdown stayed disabled').toBe(false);
  });
  await test.step('4. Open the enabled dropdown: it opens and offers existing backups', async () => {
    const texts = await dest.openBackupList(db1);
    if (texts.length === 0) throw new Error('ABORTED: the repository ' + repo + ' holds no backup to list; run a backup job into it first');
    expect(texts.length).toBeGreaterThan(0);
  });
});
