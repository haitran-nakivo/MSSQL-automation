import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../../helpers/backup-env';

// NJM-154728: "[DBM-BK-UI-General-0006-2] Verify Job List Requirements" (note in the case: duplicate requirement id).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: creates the on-demand job NJM-154728 (never run; deleted in afterEach).
// case-vs-ui: the Jobs list (tree) of Data Protection shows only the job name. The other attributes of the case (type, status, last / next run, target repository) are read
//   from the job's own page: status line "This job has not been executed yet" and the target repository name. The job "type" is not shown as a column; recorded as observed-outcome.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154728');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO lists a newly created database backup job in the Jobs list with its status and target repository', { tag: '@NJM-154728' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');

  await test.step('1. Precondition: no job named NJM-154728 exists', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named "${JOB}" already exists; remove it and run again`);
  });

  await test.step('2. Create and finish a database backup job with a chosen name: the job is created', async () => {
    await backupFlows.createJob({ name: JOB, sources: [{ item, databases: [db] }], destination: repo, finish: 'finish' });
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible({ timeout: 30_000 });
  });

  await test.step('3. Open the Jobs list in Data Protection: the new job appears', async () => {
    await backupFlows.gotoJobs();
    await expect(backupJobPage.jobRow(JOB)).toBeVisible({ timeout: 30_000 });
  });

  await test.step('4. Inspect the job attributes: status and target repository are shown on the job page', async () => {
    await backupFlows.openJob(JOB);
    await expect(backupJobPage.statusLine).toContainText('This job has not been executed yet');
    await expect(page.getByText(repo, { exact: false }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(db, { exact: false }).filter({ visible: true }).first()).toBeVisible();
    testInfo.annotations.push({ type: 'observed-outcome', description: `Job page texts: ${(await backupFlows.visibleTexts()).slice(0, 60).join(' | ')}` });
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Jobs tree lists only the name; status and target repository are on the job page; no job-type or next-run column was observed.' });
  });
});
