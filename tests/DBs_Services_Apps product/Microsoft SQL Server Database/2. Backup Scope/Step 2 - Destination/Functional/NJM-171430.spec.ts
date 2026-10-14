import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';
import { BkA5CopyFlows } from '../../../../../../flows/bkA5-copy.flows';

// NJM-171430: "Backup - Step 2 - Destination: Use an existing backup as a target - select RP from backup copy job".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: creates and runs on-demand backup jobs on one database (about 25 s each); afterEach deletes every job it created together with its backups (a backup kept by a "Change destination" stays in the old repository). Also creates and runs the backup copy job NJM-171430-copy (primary to secondary repository).
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Use an existing backup as a target" on Step 2 - Destination; in the UI it is the checkbox of the database block in "Advanced setup" with the "Select a backup" combo (it lists every backup of the chosen repository: backup name / job name).
// case-vs-ui: a backup that still belongs to a live job is refused with the pop-up "Cannot use the backup / This backup is used by the following job: <job>" when it is picked (Observed 2026-10-08), not at Finish; a free one asks "Use this backup as target?" [Proceed]. The first run on a reused backup defaults to Log in the Run dialog (fails on SIMPLE), so the spec runs it as Differential. The Backup Copy Job wizard was never opened in the UI exploration: its steps are driven by visible text only (UNVERIFIED), so this case may need locator corrections at the first run.
// UNVERIFIED: the whole Backup Copy Job wizard (menu item, source tick, destination, schedule, name) and deleting a copy job from its page (assumed to be the same Manage > Delete as a backup job).
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

test('NAKIVO lets a new backup job reuse the backup written by a backup copy job', { tag: '@NJM-171430' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(1_800_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  const copy = new BkA5CopyFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Use an existing backup as a target\" on Step 2 - Destination; in the UI it is the checkbox of the database block in \"Advanced setup\" with the \"Select a backup\" combo (it lists every backup of the chosen repository: backup name / job name). | a backup that still belongs to a live job is refused with the pop-up \"Cannot use the backup / This backup is used by the following job: <job>\" when it is picked (Observed 2026-10-08), not at Finish; a free one asks \"Use this backup as target?\" [Proceed]. The first run on a reused backup defaults to Log in the Run dialog (fails on SIMPLE), so the spec runs it as Differential. The Backup Copy Job wizard was never opened in the UI exploration: its steps are driven by visible text only (UNVERIFIED), so this case may need locator corrections at the first run." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const repo2 = readBackupRepo('SECONDARY');
  const jobSource = backupJobName('NJM-171430', '-source');
  const jobCopy = backupJobName('NJM-171430', '-copy');
  const jobName = backupJobName('NJM-171430');
  await test.step('1. Create and run a backup job to repository A', async () => {
    jobsToDiscard.push(jobSource);
    expect(await dest.createAndRunJob(jobSource, source.item, db1, repo), 'the source backup run').toBe('successful');
  });
  await test.step('2. Create and run a backup copy job to repository B', async () => {
    jobsToDiscard.push(jobCopy);
    const outcome = await copy.createAndRunCopyJob(jobCopy, jobSource, repo2);
    expect(outcome, 'the backup copy run').toBe('successful');
  });
  await test.step('3. Delete both jobs, keeping their backups', async () => {
    for (const name of [jobCopy, jobSource]) {
      await backupFlows.openJob(name);
      await backupFlows.deleteOpenJob(true);
      await backupFlows.gotoJobs();
      await expect(backupFlows.jobs.jobRow(name)).toHaveCount(0);
    }
  });
  await test.step('4. Start a new backup job and select the database', async () => {
    await backupFlows.openWizard();
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
  });
  await test.step('5. Choose "Use an existing backup as a target" and select the backup produced by the backup copy job in repository B', async () => {
    await dest.openAdvancedSetup();
    await dest.setDatabaseDestination(db1, repo2);
    await dest.tickUseExisting(db1);
    const texts = await dest.openBackupList(db1);
    expect(texts.join(' '), 'the backup of the copy job is not listed in repository B').toContain(jobCopy);
    const pick = await dest.pickBackup(jobCopy);
    expect(pick.outcome, 'the copy backup was refused: ' + pick.blockedText).toBe('confirm');
    await dest.proceedWithBackup();
    expect(await dest.backupComboValue(db1)).not.toBe('');
  });
  await test.step('6. Finish and run the job: it runs successfully and a new recovery point is created under the selected backup', async () => {
    jobsToDiscard.push(jobName);
    await dest.finishAndRunFromDestination(jobName, 'Differential');
    expect(await dest.waitForRun(), 'the run on the copy backup').toBe('successful');
    expect(await backupFlows.isDisabled(backupFlows.jobs.recoverButton)).toBe(false);
  });
});
