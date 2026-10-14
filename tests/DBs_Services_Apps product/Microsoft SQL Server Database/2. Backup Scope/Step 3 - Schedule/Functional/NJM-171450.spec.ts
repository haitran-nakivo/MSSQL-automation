import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-171450: "Backup - Step 3 - Schedule - SQL Backup type: Diferential".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-171450 (Weekly schedule, first SQL backup type Full, then changed to Differential in Edit), runs it twice (one Full and one Differential backup of the database), deletes the job
//   in afterEach (backups kept).
// case-vs-ui: the Full base (step 2) must be in the SAME job's own target to count, so the job is first created and run with type Full, then edited (step 3-4: Edit wizard, Schedule step, SQL backup type
//   Differential, Save) and run on demand again (step 5). The "SQL backup-mode control" is the SQL backup type combo of the inline schedule block (no dialog).
// case-vs-ui: the on-demand run takes its type from the Run dialog's "SQL backup type" combo (shown once a Full exists; it defaults to Log and overrides the schedule), so the test sets it to Differential.
// case-vs-ui: the recovery point type is read from msdb.backupset (D full, I differential; device_type 7 = NAKIVO's virtual device); the case's "Incremental" label belongs to the Recover wizard.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-171450');
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

test('NAKIVO runs a Differential backup and creates a Differential recovery point when the schedule SQL backup type is Differential', { tag: '@NJM-171450' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the database is in Inventory, the repository is Online and selectable, no job named NJM-171450 exists', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
  });

  await test.step('2. Run the SQL backup job once as Full to establish the base for the differential type', async () => {
    await a6.createJob({ name: JOB, item: source.item, db, repo, schedules: [{ name: 'weekly', sqlBackupType: 'Full' }], finish: 'finishAndRun' });
    jobCreated = true;
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    const rows = await a6.newNbrBackups(host, db, before);
    expect(rows.length, 'no Full recovery point was created').toBeGreaterThan(0);
    expect(rows[0].type, 'the base recovery point is not a Full backup (msdb type D)').toBe('D');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'the Full base is made by the job itself, then the same job is edited to Differential' });
  });

  await test.step('3. Open the job in Edit and go to the Schedule step: the schedule controls are available', async () => {
    await a6.openEditSchedule(JOB);
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Full');
  });

  await test.step('4. Set the SQL backup type to Differential in the SQL backup type control and save: the type is accepted for the schedule', async () => {
    await a6.fillSchedule(0, { sqlBackupType: 'Differential' });
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Differential');
    await a6.saveEdit();
  });

  await test.step('5. Run the job on demand with SQL backup type Differential: the job runs using the differential type', async () => {
    await backupFlows.openJob(JOB);
    await backupFlows.runOpenJob({ sqlBackupType: 'Differential' });
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    expect(await backupFlows.readOutcome()).toBe('successful');
  });

  await test.step('6. Open the recovery points of the database: the newest is a Differential recovery point after the Full base', async () => {
    const rows = await a6.newNbrBackups(host, db, before);
    expect(rows.length, 'fewer than two new NAKIVO backups in msdb').toBeGreaterThanOrEqual(2);
    expect(rows[0].type).toBe('D');
    expect(rows[rows.length - 1].type, 'the latest recovery point is not a Differential backup (msdb type I)').toBe('I');
    const events = await a6.eventLines(/Backup type:/i);
    testInfo.annotations.push({ type: 'observed-outcome', description: `job events with the backup type: ${events.join(' | ')}` });
  });

  await test.step('7. Check the job result and alarms: the differential backup completed successfully with no warning or failure', async () => {
    expect(await backupFlows.readStatusLine()).toMatch(/Last run was successful/);
  });
});
