import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';
import { BkA5ActionsFlows } from '../../../../../../flows/bkA5-actions.flows';

// NJM-171475: "Verify run backup job with keep retentions".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: creates the scheduled (weekly) job NJM-171475 with a 3-day retention and runs it twice on demand (Full, Differential); afterEach deletes the job and its backups.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case has a separate "Step 4 - Retention (Expert)" step with keep recovery points, GFS and immutability controls; in 11.2.1 the wizard has 4 steps and retention is the inline "Keep backups for <n> <days|weeks|months>" row of Schedule step 3 (Observed); no GFS or immutability control was seen there.
// case-vs-ui: the case keeps "the last N recovery points" and expects older ones to be pruned; the UI retention is time-based (days/weeks/months), so pruning by count cannot be shown in one test. The spec asserts the saved retention (Edit wizard and Run dialog) and two successful runs; the recovery-point count and alarms are attached as not read.
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

test('NAKIVO saves the retention of a backup job and runs it repeatedly with successful results', { tag: '@NJM-171475' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(1_500_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  const actions = new BkA5ActionsFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case has a separate \"Step 4 - Retention (Expert)\" step with keep recovery points, GFS and immutability controls; in 11.2.1 the wizard has 4 steps and retention is the inline \"Keep backups for <n> <days|weeks|months>\" row of Schedule step 3 (Observed); no GFS or immutability control was seen there. | the case keeps \"the last N recovery points\" and expects older ones to be pruned; the UI retention is time-based (days/weeks/months), so pruning by count cannot be shown in one test. The spec asserts the saved retention (Edit wizard and Run dialog) and two successful runs; the recovery-point count and alarms are attached as not read." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const jobName = backupJobName('NJM-171475');
  await test.step('1. Open Data Protection, click + and choose Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });
  await test.step('2. Advance through Source and Destination until the retention settings (Schedule) are displayed', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await backupFlows.chooseDestination(repo);
    await backupFlows.next();
    await expect(actions.o.keepBackupsLabel()).toBeVisible();
  });
  await test.step('3. Configure the retention (keep backups for 3 days) and finish the job: the retention is saved on the job', async () => {
    await backupFlows.fillSchedule({ keepFor: { count: 3, unit: 'days' } });
    await backupFlows.next();
    await backupFlows.setJobName(jobName);
    jobsToDiscard.push(jobName);
    await backupFlows.wizard.finishButton.click({ timeout: 10_000 });
    await backupFlows.jobs.statusLine.waitFor({ timeout: 60_000 });
    await dest.openEdit(jobName);
    await backupFlows.goToStep('Schedule');
    await expect(actions.o.keepBackupsCount()).toHaveValue('3');
    await backupFlows.cancelWizard();
  });
  await test.step('4. Run the job more than once: the Run dialog shows the retention and each run succeeds', async () => {
    await backupFlows.openJob(jobName);
    const dialog = await dest.openRunDialogText();
    expect(dialog).toMatch(/Keep recovery points? for 3 days?/i);
    expect(await dest.confirmOpenRunDialog(undefined), 'first run (Full)').toBe('successful');
    expect(await dest.runOpenJobAs('Differential'), 'second run (Differential)').toBe('successful');
  });
  await test.step('5. Inspect the recovery points of the job: the job page lets the user recover', async () => {
    expect(await backupFlows.isDisabled(backupFlows.jobs.recoverButton)).toBe(false);
    testInfo.annotations.push({ type: 'not-automated', description: 'Pruning of older recovery points by a count cannot be shown: the UI retention is time-based (3 days) and nothing expires within a test.' });
  });
  await test.step('6. Verify the job status: the last run was successful', async () => {
    expect(await backupFlows.readStatusLine()).toContain('Last run was successful');
    testInfo.annotations.push({ type: 'not-automated', description: 'Alarms were not read (no alarm view is automated in this spec).' });
  });
});
