import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../../helpers/backup-env';

// NJM-154733: "[DBM-Post condition-0001] Verify Post-Condition Behavior" (state after Finish / Finish & Run).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: creates the job NJM-154733 (Finish, never run) and the job NJM-154733-run (Finish & Run: one Full backup of the database); both deleted in afterEach (backups kept).
// case-vs-ui: the case's "run job on completion" option is the Finish & Run button of the last step. The post-condition reference (Backup Job Wizard - General#PostConditions) was not
//   available; "returned to the Jobs / Dashboard view" is asserted as: the wizard is gone, the URL is the Data Protection page (/c/main) and the new job's page is open.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154733');
const JOB_RUN = backupJobName('NJM-154733', '-run');
const created = new Set<string>();

test.afterEach(async ({ backupFlows }) => {
  for (const name of created) {
    try { await backupFlows.discardJobIfPresent(name); } catch { /* best effort */ }
  }
  created.clear();
});

test('NAKIVO saves the job and returns to Data Protection after Finish, and starts it after Finish & Run', { tag: '@NJM-154733' }, async ({ signedIn: _s, page, backupFlows, backupJobPage, backupWizardPage }, testInfo) => {
  test.setTimeout(900_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');

  await test.step('1. Precondition: no job named NJM-154733 or NJM-154733-run exists', async () => {
    for (const name of [JOB, JOB_RUN]) {
      if (await backupFlows.jobExists(name)) throw new Error(`ABORTED: a job named "${name}" already exists; remove it and run again`);
    }
  });

  await test.step('2. Complete all steps and click Finish: the wizard accepts Finish and closes', async () => {
    await backupFlows.createJob({ name: JOB, sources: [{ item, databases: [db] }], destination: repo, finish: 'finish' });
    created.add(JOB);
    await expect(backupWizardPage.title).toHaveCount(0, { timeout: 30_000 });
  });

  await test.step('3. After Finish: the job is saved and listed, the user is back on the Data Protection view', async () => {
    await expect(backupJobPage.statusLine).toBeVisible({ timeout: 30_000 });
    expect(page.url()).toContain('/c/main');
    await expect(backupJobPage.jobRow(JOB)).toBeVisible();
  });

  await test.step('4a. Without "run on completion" the job stays created and idle', async () => {
    await expect(backupJobPage.statusLine).toContainText('This job has not been executed yet');
  });

  await test.step('4b. With Finish & Run the job starts automatically and ends successfully', async () => {
    await backupFlows.createJob({ name: JOB_RUN, sources: [{ item, databases: [db] }], destination: repo, finish: 'finishAndRun' });
    created.add(JOB_RUN);
    await expect(backupWizardPage.title).toHaveCount(0, { timeout: 30_000 });
    await expect(backupJobPage.statusLine).toBeVisible({ timeout: 60_000 });
    const outcome = await backupFlows.waitForResult(600_000);
    testInfo.annotations.push({ type: 'observed-outcome', description: `Finish & Run job outcome: ${outcome}; status: ${await backupFlows.readStatusLine()}` });
    expect(outcome).toBe('successful');
  });
});
