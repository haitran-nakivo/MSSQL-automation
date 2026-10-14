import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-171416: "Backup - Step 2 - Destination: Use an existing backup as a target original not deleted".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: creates and runs on-demand backup jobs on one database (about 25 s each); afterEach deletes every job it created together with its backups (a backup kept by a "Change destination" stays in the old repository).
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Use an existing backup as a target" on Step 2 - Destination; in the UI it is the checkbox of the database block in "Advanced setup" with the "Select a backup" combo (it lists every backup of the chosen repository: backup name / job name).
// case-vs-ui: a backup that still belongs to a live job is refused with the pop-up "Cannot use the backup / This backup is used by the following job: <job>" when it is picked (Observed 2026-10-08), not at Finish; a free one asks "Use this backup as target?" [Proceed]. The first run on a reused backup defaults to Log in the Run dialog (fails on SIMPLE), so the spec runs it as Differential. Step 5 (creation is blocked) is therefore asserted at the pick: the pop-up appears, nothing is mapped and Next stays on Step 2.
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

test('NAKIVO refuses to use the backup of a live job as the target of a new job', { tag: '@NJM-171416' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(900_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Use an existing backup as a target\" on Step 2 - Destination; in the UI it is the checkbox of the database block in \"Advanced setup\" with the \"Select a backup\" combo (it lists every backup of the chosen repository: backup name / job name). | a backup that still belongs to a live job is refused with the pop-up \"Cannot use the backup / This backup is used by the following job: <job>\" when it is picked (Observed 2026-10-08), not at Finish; a free one asks \"Use this backup as target?\" [Proceed]. The first run on a reused backup defaults to Log in the Run dialog (fails on SIMPLE), so the spec runs it as Differential. Step 5 (creation is blocked) is therefore asserted at the pick: the pop-up appears, nothing is mapped and Next stays on Step 2." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const origJob = backupJobName('NJM-171416', '-orig');
  const jobName = backupJobName('NJM-171416');
  await test.step('1. Create and run a backup job so an existing backup with recovery points exists in the repository (its job is NOT deleted)', async () => {
    jobsToDiscard.push(origJob);
    const outcome = await dest.createAndRunJob(origJob, source.item, db1, repo);
    if (outcome !== 'successful') throw new Error('ABORTED: the precondition backup run ended "' + outcome + '"');
    expect(await backupFlows.isDisabled(backupFlows.jobs.recoverButton), 'no recovery point exists after the run').toBe(false);
  });
  await test.step('2. Start a new backup job and select the same database', async () => {
    await backupFlows.openWizard();
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
  });
  await test.step('3. On Step 2 choose "Use an existing backup as a target": the existing-backup selection is shown', async () => {
    await dest.openAdvancedSetup();
    await dest.setDatabaseDestination(db1, repo);
    await dest.tickUseExisting(db1);
    await expect(dest.p.backupCombo(db1)).toBeVisible();
  });
  await test.step('4. Select the backup that is still owned by the not-deleted original job', async () => {
    const texts = await dest.openBackupList(db1);
    expect(texts.join(' '), 'the backup of the original job is not listed').toContain(origJob);
    jobsToDiscard.push(jobName);
    const pick = await dest.pickBackup(origJob);
    expect(pick.outcome, 'the Director accepted a backup that still belongs to a live job').toBe('blocked');
  });
  await test.step('5. Attempt to create the new job: the warning names the original job, nothing is mapped and the wizard does not advance', async () => {
    const pick = await dest.p.blockedDialog.innerText();
    expect(pick).toContain('used by the following job');
    expect(pick).toContain(origJob);
    await dest.dismissBlocked();
    expect(await dest.backupComboValue(db1)).toBe('');
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
  });
  await test.step('Ad hoc (negative): Cancel discards the wizard and no job ' + jobName + ' exists', async () => {
    await backupFlows.cancelWizard();
    expect(await backupFlows.jobExists(jobName)).toBe(false);
  });
});
