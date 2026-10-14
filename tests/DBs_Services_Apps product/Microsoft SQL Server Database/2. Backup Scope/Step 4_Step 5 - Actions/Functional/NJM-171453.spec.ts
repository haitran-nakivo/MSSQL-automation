import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA5ActionsFlows } from '../../../../../../flows/bkA5-actions.flows';

// NJM-171453: "Backup - Step 4/Step 5 - Actions - Send job run report to".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPORT_EMAIL (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: creates and runs the on-demand job NJM-171453 (one Full backup, about 25 s); afterEach deletes the job and its backup. The Director may send one report e-mail to the address in NAKIVO_BK_REPORT_EMAIL.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case has a separate "Step 4/Step 5 - Actions" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options.
// case-vs-ui: step 5 checks the recipient mailbox: the test cannot read a mailbox (attached as not automated); the recovery point is checked through the enabled Recover button.
// UNVERIFIED: the recipients text input (first text input after the "Send job run reports to" checkbox) and its invalid mark.
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

test('NAKIVO accepts a job run report recipient and runs the backup job to completion', { tag: '@NJM-171453' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(900_000);
  const actions = new BkA5ActionsFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case has a separate \"Step 4/Step 5 - Actions\" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options. | step 5 checks the recipient mailbox: the test cannot read a mailbox (attached as not automated); the recovery point is checked through the enabled Recover button." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const email = readBackupValue('REPORT_EMAIL');
  const jobName = backupJobName('NJM-171453');
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
  await test.step('3. Enable "Send job run reports to" and enter a recipient e-mail address: the recipient is accepted', async () => {
    await actions.setReportRecipient('not-an-email');
    testInfo.annotations.push({ type: 'observed-outcome', description: 'recipient field invalid mark for a malformed address: ' + (await backupFlows.isInvalid(actions.o.reportRecipients())) });
    await actions.setReportRecipient(email);
    expect(await actions.isReportEnabled()).toBe(true);
    await expect(actions.o.reportRecipients()).toHaveValue(email);
    expect(await backupFlows.isInvalid(actions.o.reportRecipients()), 'the valid address is marked invalid').toBe(false);
  });
  await test.step('4. Finish creating the job and run it on demand: the job runs to completion', async () => {
    jobsToDiscard.push(jobName);
    expect(await actions.nameAndRun(jobName), 'the job run').toBe('successful');
  });
  await test.step('5. Check the recovery point (the report mailbox is not readable from the test)', async () => {
    expect(await backupFlows.isDisabled(backupFlows.jobs.recoverButton), 'no recovery point after the run').toBe(false);
    testInfo.annotations.push({ type: 'not-automated', description: 'Receipt of the job run report e-mail at ' + email + ' must be checked by hand.' });
  });
});
