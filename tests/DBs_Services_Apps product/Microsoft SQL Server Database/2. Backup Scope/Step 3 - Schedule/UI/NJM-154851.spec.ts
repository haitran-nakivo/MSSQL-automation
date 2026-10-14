import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154851: "[MSSQL-BK-UI-Sche-0005-4] Verify Differential Backup Execution Logic".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-154851 with a Periodic "every 1 minute" schedule of type Differential; it fires by itself, so afterEach DISABLES the job, waits for a running run to end and deletes it
//   (backups kept). Two scheduled runs are waited for (about 2 to 4 minutes): one Full and one Differential backup of the database are created.
// case-vs-ui: "ensure a Full backup already exists": a new job has no Full of its own, and a Differential run with no base performs a Full instead (observed 2026-10-08, no db0001 notice). The
//   job's own first scheduled run is therefore the Full base and the SECOND scheduled run is the Differential one that is asserted.
// case-vs-ui: "trigger shortly" is a Periodic schedule, Run every 1 minute, all days, Start at 0:00. No Create Schedule dialog, no Schedule card in 11.2.1.
// case-vs-ui: the recovery point "Backup type" is read from msdb.backupset of the SQL host (D full, I differential; device_type 7 = NAKIVO's virtual device); the case's "Differential (Incremental)" label is the Recover wizard's.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154851');
let jobCreated = false;

test.afterEach(async ({ page, backupFlows }) => {
  if (!jobCreated) return;
  try {
    await new BkA6ScheduleFlows(page, backupFlows).retireJob(JOB);
  } catch {
    // Best effort: the original failure is what the report shows.
  }
  jobCreated = false;
});

test('NAKIVO runs a Differential backup when a schedule of SQL backup type Differential fires after a Full backup exists', { tag: '@NJM-154851' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the instance is in Inventory and no job named NJM-154851 exists; open Data Protection > + > Backup for Database', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });

  await test.step('2. Select the database and the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Create a schedule with SQL backup type Differential set to trigger shortly (Periodic, every 1 minute) and finish the job', async () => {
    await a6.fillSchedule(0, { name: 'every minute', type: 'Periodic', periodic: { every: 1, unit: 'minutes' }, allDays: true, sqlBackupType: 'Differential' });
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Differential');
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'the job has no Full base of its own: the first scheduled run is the Full base (fallback), the second one is the Differential run' });
  });

  await test.step('4. Wait for the schedule to trigger: the job starts automatically and the first run (Full base) completes', async () => {
    expect(await a6.waitRunStart(240_000), 'the scheduled job did not start by itself within 4 minutes').toBe(true);
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
  });

  await test.step('4b. The next scheduled run starts by itself and completes', async () => {
    expect(await a6.waitRunStart(240_000), 'the second scheduled run did not start within 4 minutes').toBe(true);
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
  });

  await test.step('5. Inspect the recovery points: the first is Full, the second is Differential', async () => {
    const created = await a6.newNbrBackups(host, db, before);
    expect(created.length, 'fewer than two new NAKIVO backups in msdb').toBeGreaterThanOrEqual(2);
    expect(created[0].type, 'the base run is not a Full backup (msdb type D)').toBe('D');
    expect(created[1].type, 'the second scheduled run is not a Differential backup (msdb type I)').toBe('I');
    const events = await a6.eventLines(/Backup type:/i);
    testInfo.annotations.push({ type: 'observed-outcome', description: `job events with the backup type: ${events.join(' | ')}` });
  });
});
