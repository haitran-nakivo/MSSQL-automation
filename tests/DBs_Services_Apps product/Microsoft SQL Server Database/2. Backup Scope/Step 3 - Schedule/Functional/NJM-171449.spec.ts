import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-171449: "Backup - Step 3 - Schedule - SQL Backup type: Full".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-171449 with one Weekly schedule of SQL backup type Full, runs it once (one Full backup of the database), deletes the job in afterEach (backups kept).
// case-vs-ui: the "SQL backup-mode control" is the "SQL backup type" combo of the inline schedule block (no dialog). "Run it on demand" is Finish & Run: the first run has no SQL backup type choice in
//   the Run dialog (it appears after a Full exists), so the run uses the schedule's type.
// case-vs-ui: the recovery point type is read from msdb.backupset (D = full; device_type 7 = NAKIVO's virtual device), not from the recovery-point list; the case's "type Full" matches msdb type D.
//   "No alarm" is the run ending "Last run was successful" (a warning ends as warning, a failure as failed).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-171449');
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

test('NAKIVO runs a Full backup and creates a Full recovery point when the schedule SQL backup type is Full', { tag: '@NJM-171449' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the database is in Inventory, the repository is Online and selectable, no job named NJM-171449 exists', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
  });

  await test.step('2. Open Data Protection > + > Backup for Database, select the database and the repository and go to the Schedule step', async () => {
    await a6.openScheduleStep(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Set the SQL backup type to Full in the SQL backup type control: the type is accepted for the schedule', async () => {
    await a6.fillSchedule(0, { name: 'full', sqlBackupType: 'Full' });
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Full');
  });

  await test.step('4. Finish creating the job and run it on demand (Finish & Run): the job runs', async () => {
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finishAndRun');
    jobCreated = true;
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'the type of the first on-demand run comes from the schedule; the Run dialog offers an SQL backup type only after a Full exists' });
  });

  await test.step('5. Open the recovery points of the database: a Full recovery point was created in the repository', async () => {
    const rows = await a6.newNbrBackups(host, db, before);
    expect(rows.length, 'no new NAKIVO backup of the database in msdb').toBeGreaterThan(0);
    expect(rows[0].type, 'the recovery point is not a Full backup (msdb type D)').toBe('D');
    await expect(page.getByText(repo, { exact: false }).filter({ visible: true }).first()).toBeVisible();
  });

  await test.step('6. Check the job result and alarms: the full backup completed successfully with no warning or failure', async () => {
    expect(await backupFlows.readOutcome()).toBe('successful');
    expect(await backupFlows.readStatusLine()).toMatch(/Last run was successful/);
  });
});
