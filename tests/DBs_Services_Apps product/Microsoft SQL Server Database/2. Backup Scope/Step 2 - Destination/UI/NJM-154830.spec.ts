import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-154830: "[DBM-BK-UI-Dest-0017-3-6] Verify Source Backup Disable".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: creates and runs the on-demand job NJM-154830-source (one Full backup of the database in the primary repository, about 25 s); afterEach deletes the job AND its backup.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Fast Setup" / "Advanced Setup": the UI has the "Destination:" combo above an "Advanced setup..." link that lists one block per ticked item and one row per database ("Click to expand").
// case-vs-ui: the case calls the control "Use existing backup" with a "Target backup" dropdown; the UI label is "Use an existing backup as a target" and the combo shows "Select a backup".
// case-vs-ui: the case expects the own backup to be greyed out in the list; Observed in the UI: a backup used by a live job is NOT greyed, picking it opens "Cannot use the backup / This backup is used by the following job: <job>" [OK]. The spec asserts that pop-up.
test.use(RUN_OPTIONS);

const jobsToDiscard: string[] = [];
test.afterEach(async ({ backupFlows }) => {
  for (const name of jobsToDiscard.reverse()) {
    try {
      await backupFlows.discardJobIfPresent(name, false);
    } catch {
      // Best effort: the original failure is what the report shows.
    }
  }
  jobsToDiscard.length = 0;
});

test('NAKIVO refuses to use the backup of a database as the target of a second job (circular reference)', { tag: '@NJM-154830' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Fast Setup\" / \"Advanced Setup\": the UI has the \"Destination:\" combo above an \"Advanced setup...\" link that lists one block per ticked item and one row per database (\"Click to expand\"). | the case calls the control \"Use existing backup\" with a \"Target backup\" dropdown; the UI label is \"Use an existing backup as a target\" and the combo shows \"Select a backup\". | the case expects the own backup to be greyed out in the list; Observed in the UI: a backup used by a live job is NOT greyed, picking it opens \"Cannot use the backup / This backup is used by the following job: <job>\" [OK]. The spec asserts that pop-up." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const sourceJob = backupJobName('NJM-154830', '-source');
  await test.step('1. Precondition: a job with a backup of the database exists (creates and runs ' + sourceJob + ')', async () => {
    jobsToDiscard.push(sourceJob);
    const outcome = await dest.createAndRunJob(sourceJob, source.item, db1, repo);
    if (outcome !== 'successful') throw new Error('ABORTED: the precondition backup run ended "' + outcome + '"');
  });
  await test.step('2. Start a new job, select the same database and go to Step 2 (Destination)', async () => {
    await backupFlows.openWizard();
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
  });
  await test.step('3. Open the existing-backup list and pick the backup of the database that is being configured: it cannot be used as its own target', async () => {
    await dest.openAdvancedSetup();
    await dest.setDatabaseDestination(db1, repo);
    await dest.tickUseExisting(db1);
    const texts = await dest.openBackupList(db1);
    expect(texts.join(' '), 'the backup of the source job is not listed').toContain(sourceJob);
    const pick = await dest.pickBackup(sourceJob);
    expect(pick.outcome, 'the same-source backup was accepted as a target').toBe('blocked');
    expect(pick.blockedText).toContain(sourceJob);
  });
  await test.step('4. Attempt to select it again: it stays unselectable and no backup is mapped', async () => {
    await dest.dismissBlocked();
    expect(await dest.backupComboValue(db1)).toBe('');
  });
});
