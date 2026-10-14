import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-171417: "Backup - Step 2 - Destination: Use an existing backup as a target from other repository".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: creates and runs on-demand backup jobs on one database (about 25 s each); afterEach deletes every job it created together with its backups (a backup kept by a "Change destination" stays in the old repository). Job A (primary repository) is deleted keeping its backup, job B (secondary repository) is re-targeted to that backup.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Use an existing backup as a target" on Step 2 - Destination; in the UI it is the checkbox of the database block in "Advanced setup" with the "Select a backup" combo (it lists every backup of the chosen repository: backup name / job name).
// case-vs-ui: a backup that still belongs to a live job is refused with the pop-up "Cannot use the backup / This backup is used by the following job: <job>" when it is picked (Observed 2026-10-08), not at Finish; a free one asks "Use this backup as target?" [Proceed]. The first run on a reused backup defaults to Log in the Run dialog (fails on SIMPLE), so the spec runs it as Differential. "A new recovery point is created (the previous chain is not continued)" is not readable from the job page; the run result and Target Storage are asserted and the recovery point count is attached as not read.
// UNVERIFIED: the Edit button of a job page, the order of the "Change backup destination?" question and the Run dialog after "Save & Run".
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

test('NAKIVO lets a job reuse a backup from another repository after the original job is deleted and runs it successfully', { tag: '@NJM-171417' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(1_500_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Use an existing backup as a target\" on Step 2 - Destination; in the UI it is the checkbox of the database block in \"Advanced setup\" with the \"Select a backup\" combo (it lists every backup of the chosen repository: backup name / job name). | a backup that still belongs to a live job is refused with the pop-up \"Cannot use the backup / This backup is used by the following job: <job>\" when it is picked (Observed 2026-10-08), not at Finish; a free one asks \"Use this backup as target?\" [Proceed]. The first run on a reused backup defaults to Log in the Run dialog (fails on SIMPLE), so the spec runs it as Differential. \"A new recovery point is created (the previous chain is not continued)\" is not readable from the job page; the run result and Target Storage are asserted and the recovery point count is attached as not read." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const repo2 = readBackupRepo('SECONDARY');
  const repoA = repo;
  const repoB = repo2;
  const jobA = backupJobName('NJM-171417', '-A');
  const jobB = backupJobName('NJM-171417');
  await test.step('1. Create and run a backup job to repository A: Full, then Differential', async () => {
    if (repoA === repoB) throw new Error('ABORTED: NAKIVO_BK_REPO_PRIMARY and NAKIVO_BK_REPO_SECONDARY name the same repository');
    jobsToDiscard.push(jobA);
    expect(await dest.createAndRunJob(jobA, source.item, db1, repoA), 'the Full run to repository A').toBe('successful');
    expect(await dest.runOpenJobAs('Differential'), 'the Differential run to repository A').toBe('successful');
  });
  await test.step('2. Create and run a backup job to repository B (Full)', async () => {
    jobsToDiscard.push(jobB);
    expect(await dest.createAndRunJob(jobB, source.item, db1, repoB), 'the Full run to repository B').toBe('successful');
  });
  await test.step('3. Delete the job that targeted repository A, keeping its backup', async () => {
    await backupFlows.openJob(jobA);
    await backupFlows.deleteOpenJob(true);
    await backupFlows.gotoJobs();
    await expect(backupFlows.jobs.jobRow(jobA)).toHaveCount(0);
  });
  await test.step('4. Edit the repository B job and open Step 2 - Destination', async () => {
    await dest.openEdit(jobB);
    await backupFlows.goToStep('Destination');
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
  });
  await test.step('5. Choose "Use an existing backup as a target" and select the backup of repository A', async () => {
    await dest.openAdvancedSetup();
    await dest.setDatabaseDestination(db1, repoA);
    await dest.tickUseExisting(db1);
    const texts = await dest.openBackupList(db1);
    expect(texts.join(' '), 'the backup of the deleted job A is not listed for repository A').toContain(jobA);
    const pick = await dest.pickBackup(jobA);
    expect(pick.outcome, 'a backup of a deleted job should be free: ' + pick.blockedText).toBe('confirm');
    await dest.proceedWithBackup();
    expect(await dest.backupComboValue(db1)).not.toBe('');
  });
  await test.step('6. Save and run the job: it runs successfully on the backup from the other repository', async () => {
    const outcome = await dest.saveAndRun('Differential');
    expect(outcome, 'the re-targeted job run').toBe('successful');
    await expect(page.getByText(repoA, { exact: false }).filter({ visible: true }).first()).toBeVisible();
    testInfo.annotations.push({ type: 'observed-outcome', description: 'Recovery point count / chain continuation were not read (the job page shows no per-run chain); status: ' + (await backupFlows.readStatusLine()) });
  });
});
