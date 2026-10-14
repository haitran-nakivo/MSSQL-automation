import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA5ActionsFlows } from '../../../../../../flows/bkA5-actions.flows';

// NJM-171456: "Backup - Step 4/Step 5 - Actions - Run job with all options".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPORT_EMAIL, NAKIVO_BK_PRE_SCRIPT, NAKIVO_BK_POST_SCRIPT (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: creates and runs the on-demand job NJM-171456 (one Full backup); afterEach deletes the job and its backup. The Director runs both owner scripts and may send one report e-mail to NAKIVO_BK_REPORT_EMAIL.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case has a separate "Step 4/Step 5 - Actions" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options.
// case-vs-ui: the report mailbox and the script order on the Director host cannot be read by the test (attached as not automated); success of the job with "Fail the job on script failure" on both scripts and the enabled Recover button are asserted.
// UNVERIFIED: the recipient input and the script settings popovers (see NJM-171453 and NJM-171454).
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

test('NAKIVO runs a backup job with the report recipient, the pre job script and the post job script together', { tag: '@NJM-171456' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(900_000);
  const actions = new BkA5ActionsFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case has a separate \"Step 4/Step 5 - Actions\" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options. | the report mailbox and the script order on the Director host cannot be read by the test (attached as not automated); success of the job with \"Fail the job on script failure\" on both scripts and the enabled Recover button are asserted." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const email = readBackupValue('REPORT_EMAIL');
  const preScript = readBackupValue('PRE_SCRIPT');
  const postScript = readBackupValue('POST_SCRIPT');
  const jobName = backupJobName('NJM-171456');
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
  await test.step('3. Enable all Actions options together: report recipient, pre job script and post job script are configured', async () => {
    await actions.setReportRecipient(email);
    await actions.configureScript('pre', { path: preScript, onError: 'Fail' });
    await actions.configureScript('post', { path: postScript, onError: 'Fail' });
    expect(await actions.isReportEnabled()).toBe(true);
    expect(await actions.isScriptEnabled('pre')).toBe(true);
    expect(await actions.isScriptEnabled('post')).toBe(true);
    await expect(actions.o.reportRecipients()).toHaveValue(email);
  });
  await test.step('4. Finish creating the job and run it on demand: the job runs to completion', async () => {
    jobsToDiscard.push(jobName);
    expect(await actions.nameAndRun(jobName), 'the job run with all Actions options').toBe('successful');
  });
  await test.step('5. Verify the configured actions and the recovery point: no script failed and a recovery point exists', async () => {
    const failed = await actions.pageTextsMatching(/(pre|post) job script.*(failed|error)|RunLocalExecutable/i);
    expect(failed, 'the job page reports a failed script action').toEqual([]);
    expect(await backupFlows.isDisabled(backupFlows.jobs.recoverButton)).toBe(false);
    testInfo.annotations.push({ type: 'not-automated', description: 'Receipt of the report e-mail at ' + email + ' and the pre/post script order on the Director host must be checked by hand.' });
  });
});
