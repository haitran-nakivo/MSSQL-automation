import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-171433: "Backup - Step 3 - Schedule - Weekly".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-171433 with one Weekly schedule (Mon-Fri, Start at 1:30), runs it ONCE on demand (one Full backup of the database), deletes the job in afterEach (backups kept).
// case-vs-ui: steps 5-6 wait for "the next Weekly occurrence", which cannot be awaited (up to a week; the Director clock cannot be advanced). Replaced by an on-demand run of the saved job: it shows that
//   the Weekly job runs and creates a recovery point in the repository. That the schedule itself triggers an automatic run is covered with a Periodic every-1-minute schedule (NJM-171436, NJM-154857).
//   The saved Weekly recurrence is asserted from the job page summary and the Edit wizard instead.
// case-vs-ui: "enable scheduling" = leave "Do not schedule, run on demand" unticked; the schedule is an inline block, not a dialog. Weekdays are the default Mon-Fri.
// UNVERIFIED: the next-run text on the job page after a run is not in the notes; the schedule lines are attached as observed-outcome.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-171433');
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

test('NAKIVO saves a Weekly schedule on a Microsoft SQL Server database backup job and the job backs up to the repository', { tag: '@NJM-171433' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the database is in Inventory, the repository is Online and selectable, no job named NJM-171433 exists', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
  });

  await test.step('2. Open Data Protection > + > Backup for Database, select the database and the repository and go to the Schedule step', async () => {
    await a6.openScheduleStep(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
    await expect(backupFlows.wizard.onDemandCheckbox).toBeVisible();
  });

  await test.step('3. Set the recurrence to Weekly (Mon-Fri, Start at 1:30): the recurrence is accepted and its parameters are shown', async () => {
    await a6.fillSchedule(0, { name: 'weekly', type: 'Weekly', startAt: '1:30' });
    await expect(a6.ui.typeInput(0)).toHaveValue('Weekly');
    await expect(a6.ui.everyWeeksInput(0)).toHaveValue('1');
    await expect(a6.ui.startAtInput(0)).toHaveValue('1:30');
    expect(await a6.isTicked(a6.ui.dayLabel(0, 'Mon'))).toBe(true);
    expect(await a6.isTicked(a6.ui.dayLabel(0, 'Sat'))).toBe(false);
  });

  await test.step('4. Finish creating the job and open it: the job is created and its schedule shows the Weekly recurrence', async () => {
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await backupFlows.openJob(JOB);
    const lines = await a6.scheduleLines();
    testInfo.annotations.push({ type: 'observed-outcome', description: `job page schedule lines: ${lines.join(' | ')}` });
    expect(lines.join(' ')).toContain('Monday through Friday');
    await expect(page.getByText('Waiting on schedule', { exact: false }).filter({ visible: true }).first()).toBeVisible();
    await a6.openEditSchedule(JOB);
    const state = await a6.readSchedule(0);
    expect(state.type).toBe('Weekly');
    await expect(a6.ui.startAtInput(0)).toHaveValue('1:30');
    await a6.closeEditor();
  });

  await test.step('5. Next Weekly occurrence (not awaitable): run the saved job on demand and monitor it', async () => {
    await backupFlows.openJob(JOB);
    await backupFlows.runOpenJob();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'the next Weekly occurrence cannot be awaited; the saved job is run on demand instead' });
  });

  await test.step('6. The backup completes successfully and creates a recovery point in the repository; the Weekly schedule remains', async () => {
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    await expect(page.getByText(repo, { exact: false }).filter({ visible: true }).first()).toBeVisible();
    const created = await a6.newNbrBackups(host, db, before);
    expect(created.length, 'no new NAKIVO backup of the database in msdb').toBeGreaterThan(0);
    testInfo.annotations.push({ type: 'observed-outcome', description: `job page schedule lines after the run: ${(await a6.scheduleLines()).join(' | ')}` });
  });
});
