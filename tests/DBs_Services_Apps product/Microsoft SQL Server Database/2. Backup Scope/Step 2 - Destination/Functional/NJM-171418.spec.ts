import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-171418: "Backup - Step 2 - Destination: Use an existing backup as a target original deleted".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: creates and runs on-demand backup jobs on one database (about 25 s each); afterEach deletes every job it created together with its backups (a backup kept by a "Change destination" stays in the old repository).
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Use an existing backup as a target" on Step 2 - Destination; in the UI it is the checkbox of the database block in "Advanced setup" with the "Select a backup" combo (it lists every backup of the chosen repository: backup name / job name).
// case-vs-ui: a backup that still belongs to a live job is refused with the pop-up "Cannot use the backup / This backup is used by the following job: <job>" when it is picked (Observed 2026-10-08), not at Finish; a free one asks "Use this backup as target?" [Proceed]. The first run on a reused backup defaults to Log in the Run dialog (fails on SIMPLE), so the spec runs it as Differential. Step 6 ("open the backup in the repository") is checked on the job page: Recover is enabled and Target Storage names the repository.
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

test('NAKIVO lets a new job reuse the backup of a deleted job and runs it successfully', { tag: '@NJM-171418' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Use an existing backup as a target\" on Step 2 - Destination; in the UI it is the checkbox of the database block in \"Advanced setup\" with the \"Select a backup\" combo (it lists every backup of the chosen repository: backup name / job name). | a backup that still belongs to a live job is refused with the pop-up \"Cannot use the backup / This backup is used by the following job: <job>\" when it is picked (Observed 2026-10-08), not at Finish; a free one asks \"Use this backup as target?\" [Proceed]. The first run on a reused backup defaults to Log in the Run dialog (fails on SIMPLE), so the spec runs it as Differential. Step 6 (\"open the backup in the repository\") is checked on the job page: Recover is enabled and Target Storage names the repository." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const origJob = backupJobName('NJM-171418', '-orig');
  const jobName = backupJobName('NJM-171418');
  await test.step('1. Create and run a backup job so a backup exists in the repository', async () => {
    jobsToDiscard.push(origJob);
    expect(await dest.createAndRunJob(origJob, source.item, db1, repo), 'the precondition run').toBe('successful');
  });
  await test.step('2. Delete the backup job, keeping the backup: the job is gone', async () => {
    await backupFlows.openJob(origJob);
    await backupFlows.deleteOpenJob(true);
    await backupFlows.gotoJobs();
    await expect(backupFlows.jobs.jobRow(origJob)).toHaveCount(0);
  });
  await test.step('3. Start a new backup job and select the database', async () => {
    await backupFlows.openWizard();
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
  });
  await test.step('4. On Step 2 choose "Use an existing backup as a target" and select the backup of the deleted job: it is accepted', async () => {
    await dest.openAdvancedSetup();
    await dest.setDatabaseDestination(db1, repo);
    await dest.tickUseExisting(db1);
    const texts = await dest.openBackupList(db1);
    expect(texts.join(' '), 'the backup of the deleted job is not listed').toContain(origJob);
    const pick = await dest.pickBackup(origJob);
    expect(pick.outcome, 'the backup of a deleted job was refused: ' + pick.blockedText).toBe('confirm');
    await dest.proceedWithBackup();
    expect(await dest.backupComboValue(db1)).not.toBe('');
  });
  await test.step('5. Finish and run the job: it runs successfully', async () => {
    jobsToDiscard.push(jobName);
    await dest.finishAndRunFromDestination(jobName, 'Differential');
    expect(await dest.waitForRun(), 'the run on the reused backup').toBe('successful');
  });
  await test.step('6. Open the backup: the recovery point is available under the reused backup', async () => {
    expect(await backupFlows.isDisabled(backupFlows.jobs.recoverButton), 'Recover is disabled: no recovery point').toBe(false);
    await expect(page.getByText(repo, { exact: false }).filter({ visible: true }).first()).toBeVisible();
  });
});
