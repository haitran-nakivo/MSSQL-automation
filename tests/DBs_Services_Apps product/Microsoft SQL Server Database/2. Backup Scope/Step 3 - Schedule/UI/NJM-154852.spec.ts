import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154852: "[MSSQL-BK-UI-Sche-0005-5] Verify Log Backup Execution Logic".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (a database in the FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-154852 with a Periodic "every 1 minute" schedule of type Log; it fires by itself, so afterEach DISABLES the job, waits for a running run to end and deletes it
//   (backups kept). Two scheduled runs are waited for (about 2 to 4 minutes): one Full and one transaction-log backup of the database are created.
// case-vs-ui: "an existing Full backup": the job's own first scheduled run is the Full base (a Log run with no base performs a Full instead, observed 2026-10-08); the SECOND scheduled run is the Log run asserted.
// case-vs-ui: "trigger shortly" is a Periodic schedule, Run every 1 minute, all days, Start at 0:00. No Create Schedule dialog, no Schedule card in 11.2.1.
// case-vs-ui: the recovery point "Backup type" is read from msdb.backupset (D full, L log; device_type 7 = NAKIVO's virtual device); the case's "Transaction Log" label is the Recover wizard's.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154852');
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

test('NAKIVO runs a transaction log backup when a schedule of SQL backup type Log fires on a FULL recovery model database', { tag: '@NJM-154852' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the database is in the FULL (or BULK_LOGGED) recovery model and no job named NJM-154852 exists; open Data Protection > + > Backup for Database', async () => {
    const model = await host.recoveryModel(db);
    if (model !== 'FULL' && model !== 'BULK_LOGGED') throw new Error(`ABORTED: database ${db} is in the ${model} recovery model; a Log backup needs FULL or BULK_LOGGED`);
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });

  await test.step('2. Select the database and the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Create a schedule with SQL backup type Log set to trigger shortly (Periodic, every 1 minute) and finish the job', async () => {
    await a6.fillSchedule(0, { name: 'every minute', type: 'Periodic', periodic: { every: 1, unit: 'minutes' }, allDays: true, sqlBackupType: 'Log' });
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Log');
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'the job has no Full base of its own: the first scheduled run is the Full base (fallback), the second one is the Log run' });
  });

  await test.step('4. Wait for the schedule to trigger: the job starts automatically and the first run (Full base) completes', async () => {
    expect(await a6.waitRunStart(240_000), 'the scheduled job did not start by itself within 4 minutes').toBe(true);
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
  });

  await test.step('4b. The next scheduled run starts by itself and completes', async () => {
    expect(await a6.waitRunStart(240_000), 'the second scheduled run did not start within 4 minutes').toBe(true);
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
  });

  await test.step('5. Inspect the recovery points: the first is Full, the second is a transaction log backup', async () => {
    const created = await a6.newNbrBackups(host, db, before);
    expect(created.length, 'fewer than two new NAKIVO backups in msdb').toBeGreaterThanOrEqual(2);
    expect(created[0].type, 'the base run is not a Full backup (msdb type D)').toBe('D');
    expect(created[1].type, 'the second scheduled run is not a log backup (msdb type L)').toBe('L');
    const events = await a6.eventLines(/Backup type:/i);
    testInfo.annotations.push({ type: 'observed-outcome', description: `job events with the backup type: ${events.join(' | ')}` });
  });
});
