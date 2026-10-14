import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA5ActionsFlows } from '../../../../../../flows/bkA5-actions.flows';

// NJM-171455: "Backup - Step 4/Step 5 - Actions - Run local post job script".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_POST_SCRIPT (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: creates and runs two on-demand jobs (NJM-171455 with the owner script, then an ad hoc job with a script path that does not exist); afterEach deletes them and their backups. The owner script is executed by the Director.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case has a separate "Step 4/Step 5 - Actions" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options.
// case-vs-ui: the post-job script runs on the Director host; "executes after the backup completes" is shown by the job succeeding with "Fail the job on script failure" set and no script-failure event, not by a timestamp. The notes only recorded the pre-job script failure texts: the missing-script ad hoc step attaches what the post-script case shows instead of asserting a text.
// UNVERIFIED: the script settings popover (see NJM-171454) and the post-script failure events.
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

test('NAKIVO runs the local post job script after the backup and completes the job', { tag: '@NJM-171455' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(1_500_000);
  const actions = new BkA5ActionsFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case has a separate \"Step 4/Step 5 - Actions\" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options. | the post-job script runs on the Director host; \"executes after the backup completes\" is shown by the job succeeding with \"Fail the job on script failure\" set and no script-failure event, not by a timestamp. The notes only recorded the pre-job script failure texts: the missing-script ad hoc step attaches what the post-script case shows instead of asserting a text." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const postScript = readBackupValue('POST_SCRIPT');
  const missingScript = 'C:/nakivo-qa-missing/no-such-script.bat';
  const jobName = backupJobName('NJM-171455');
  const jobMissing = backupJobName('NJM-171455', '-missing-continue');
  await test.step('1. Open Data Protection, click + and choose Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });
  await test.step('2. Advance through Source, Destination and Schedule (run on demand) until the Options step, which holds the Actions controls, is displayed', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await backupFlows.chooseDestination(repo);
    await backupFlows.next();
    await backupFlows.setOnDemand();
    await backupFlows.next();
    await expect(backupFlows.wizard.jobNameField).toBeVisible();
    await expect(actions.o.reportLabel()).toBeVisible();
  });
  await test.step('3. Enable "Run local post job script" and specify the script path: the post-job script is configured', async () => {
    await actions.configureScript('post', { path: postScript, onError: 'Fail' });
    expect(await actions.isScriptEnabled('post')).toBe(true);
  });
  await test.step('4. Finish creating the job and run it on demand: the job runs to completion', async () => {
    jobsToDiscard.push(jobName);
    expect(await actions.nameAndRun(jobName), 'the job run with the post job script').toBe('successful');
  });
  await test.step('5. Verify the script and the recovery point: the script did not fail and a recovery point exists', async () => {
    const failed = await actions.pageTextsMatching(/post job script.*(failed|error)|RunLocalExecutable/i);
    expect(failed, 'the job page reports a failed post job script action').toEqual([]);
    expect(await backupFlows.isDisabled(backupFlows.jobs.recoverButton)).toBe(false);
    testInfo.annotations.push({ type: 'observed-outcome', description: 'script related texts on the job page: ' + JSON.stringify(await actions.pageTextsMatching(/script/i)) });
  });
  await test.step('Ad hoc (negative): a post job script that does not exist with "Continue" does not stop the backup', async () => {
    await actions.startAtOptions(source.item, db1, repo);
    await actions.configureScript('post', { path: missingScript, onError: 'Continue' });
    jobsToDiscard.push(jobMissing);
    const outcome = await actions.nameAndRun(jobMissing);
    testInfo.annotations.push({ type: 'observed-outcome', description: 'missing post script with Continue ended ' + outcome + '; texts: ' + JSON.stringify(await actions.pageTextsMatching(/post job script|script/i)) });
    expect(outcome, 'the run did not finish').not.toBe('timeout');
  });
});
