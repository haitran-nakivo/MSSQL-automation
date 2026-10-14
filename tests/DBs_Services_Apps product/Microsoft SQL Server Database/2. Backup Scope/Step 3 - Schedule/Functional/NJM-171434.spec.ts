import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-171434: "Backup - Step 3 - Schedule - Monthly".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-171434 with one Monthly schedule (default day, Start at 1:30), runs it ONCE on demand (one Full backup of the database), deletes the job in afterEach (backups kept).
//   Finish may show the self-backup warning (a schedule covering 02:00): it is confirmed with Proceed.
// case-vs-ui: steps 5-6 wait for "the next Monthly occurrence", which cannot be awaited (up to a month). Replaced by an on-demand run of the saved job (a recovery point is created in the repository);
//   the automatic trigger itself is covered with a Periodic every-1-minute schedule (NJM-171436, NJM-154857). The saved Monthly recurrence is asserted from the Edit wizard.
// case-vs-ui: "<day-of-month>" is left at the wizard's default (the Monthly fields "Repeat every month / Run every ..." were not explored in detail); "enable scheduling" = leave "Do not schedule, run on demand" unticked.
// UNVERIFIED: the job page summary wording for Monthly is not in the notes: its lines are attached as observed-outcome and only checked to exist.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-171434');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try {
    await backupFlows.discardJobIfPresent(JOB);
  } catch {
    // Best effort: the original failure is what the report shows.
  }
  jobCreated = false;
});

test('NAKIVO saves a Monthly schedule on a Microsoft SQL Server database backup job and the job backs up to the repository', { tag: '@NJM-171434' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the database is in Inventory, the repository is Online and selectable, no job named NJM-171434 exists', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
  });

  await test.step('2. Open Data Protection > + > Backup for Database, select the database and the repository and go to the Schedule step', async () => {
    await a6.openScheduleStep(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Set the recurrence to Monthly (Start at 1:30): the recurrence is accepted and its parameters are shown', async () => {
    await a6.fillSchedule(0, { name: 'monthly', type: 'Monthly', startAt: '1:30' });
    await expect(a6.ui.typeInput(0)).toHaveValue('Monthly');
    await expect(a6.ui.block(0).getByText('Run every', { exact: false }).filter({ visible: true }).first()).toBeVisible();
    await expect(a6.ui.startAtInput(0)).toHaveValue('1:30');
  });

  await test.step('4. Finish creating the job and open it: the job is created and its schedule shows the Monthly recurrence', async () => {
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await backupFlows.openJob(JOB);
    const lines = await a6.scheduleLines();
    testInfo.annotations.push({ type: 'observed-outcome', description: `job page schedule lines: ${lines.join(' | ')}` });
    expect(lines.length, 'the job page shows no schedule summary').toBeGreaterThan(0);
    await a6.openEditSchedule(JOB);
    expect((await a6.readSchedule(0)).type).toBe('Monthly');
    await expect(a6.ui.startAtInput(0)).toHaveValue('1:30');
    await a6.closeEditor();
  });

  await test.step('5. Next Monthly occurrence (not awaitable): run the saved job on demand and monitor it', async () => {
    await backupFlows.openJob(JOB);
    await backupFlows.runOpenJob();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'the next Monthly occurrence cannot be awaited; the saved job is run on demand instead' });
  });

  await test.step('6. The backup completes successfully and creates a recovery point in the repository', async () => {
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    await expect(page.getByText(repo, { exact: false }).filter({ visible: true }).first()).toBeVisible();
    const created = await a6.newNbrBackups(host, db, before);
    expect(created.length, 'no new NAKIVO backup of the database in msdb').toBeGreaterThan(0);
    testInfo.annotations.push({ type: 'observed-outcome', description: `job page schedule lines after the run: ${(await a6.scheduleLines()).join(' | ')}` });
  });
});
