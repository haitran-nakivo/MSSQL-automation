import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA5ActionsFlows } from '../../../../../../flows/bkA5-actions.flows';

// NJM-171454: "Backup - Step 4/Step 5 - Actions - Run local pre job script".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_PRE_SCRIPT (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: creates and runs three on-demand jobs (NJM-171454 with the owner script, then two ad hoc jobs with a script path that does not exist); afterEach deletes them and their backups. The owner script is executed by the Director.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case has a separate "Step 4/Step 5 - Actions" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options.
// case-vs-ui: the pre-job script runs on the Director host (Windows); the test cannot see the host, so "runs before the backup" is shown by the job succeeding with "Fail the job on script failure" set and no script-failure event, not by a timestamp. Observed (2026-10-08): a missing script with Fail fails the job ("The execution of the pre job script action has failed"), with Continue the job succeeds and logs the failed action; both are asserted as ad hoc steps.
// UNVERIFIED: the script settings popover (Script path, Error handling and its "Fail" / "Continue" item texts, how the popover closes) and where the failed-action events are listed.
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

test('NAKIVO runs the local pre job script before the backup and completes the job', { tag: '@NJM-171454' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(1_800_000);
  const actions = new BkA5ActionsFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case has a separate \"Step 4/Step 5 - Actions\" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options. | the pre-job script runs on the Director host (Windows); the test cannot see the host, so \"runs before the backup\" is shown by the job succeeding with \"Fail the job on script failure\" set and no script-failure event, not by a timestamp. Observed (2026-10-08): a missing script with Fail fails the job (\"The execution of the pre job script action has failed\"), with Continue the job succeeds and logs the failed action; both are asserted as ad hoc steps." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const preScript = readBackupValue('PRE_SCRIPT');
  const missingScript = 'C:/nakivo-qa-missing/no-such-script.bat';
  const jobName = backupJobName('NJM-171454');
  const jobFail = backupJobName('NJM-171454', '-missing-fail');
  const jobContinue = backupJobName('NJM-171454', '-missing-continue');
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
  await test.step('3. Enable "Run local pre job script" and specify the script path: the pre-job script is configured', async () => {
    await actions.configureScript('pre', { path: preScript, onError: 'Fail' });
    expect(await actions.isScriptEnabled('pre')).toBe(true);
  });
  await test.step('4. Finish creating the job and run it on demand: the job runs to completion', async () => {
    jobsToDiscard.push(jobName);
    expect(await actions.nameAndRun(jobName), 'the job run with the pre job script').toBe('successful');
  });
  await test.step('5. Verify the script and the recovery point: the script did not fail and a recovery point exists', async () => {
    const failed = await actions.pageTextsMatching(/pre job script.*(failed|error)|RunLocalExecutable/i);
    expect(failed, 'the job page reports a failed pre job script action').toEqual([]);
    expect(await backupFlows.isDisabled(backupFlows.jobs.recoverButton)).toBe(false);
    testInfo.annotations.push({ type: 'observed-outcome', description: 'script related texts on the job page: ' + JSON.stringify(await actions.pageTextsMatching(/script/i)) });
  });
  await test.step('Ad hoc (negative): a pre job script that does not exist with "Fail" fails the job', async () => {
    await actions.startAtOptions(source.item, db1, repo);
    await actions.configureScript('pre', { path: missingScript, onError: 'Fail' });
    jobsToDiscard.push(jobFail);
    expect(await actions.nameAndRun(jobFail), 'a missing pre script with Fail').toBe('failed');
    expect((await actions.pageTextsMatching(/pre job script/i)).length, 'no pre job script event on the failed job').toBeGreaterThan(0);
  });
  await test.step('Ad hoc (negative): a pre job script that does not exist with "Continue" lets the job succeed and logs the failed action', async () => {
    await actions.startAtOptions(source.item, db1, repo);
    await actions.configureScript('pre', { path: missingScript, onError: 'Continue' });
    jobsToDiscard.push(jobContinue);
    expect(await actions.nameAndRun(jobContinue), 'a missing pre script with Continue').toBe('successful');
    expect((await actions.pageTextsMatching(/pre job script/i)).length, 'the failed pre job script action is not logged').toBeGreaterThan(0);
  });
});
