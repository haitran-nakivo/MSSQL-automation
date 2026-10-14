import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154859: "[MSSQL-BK-UI-Sche-0008] Verify Schedule Collision Priority".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-154859 with THREE Periodic "every 1 minute" schedules (Full, Differential, Log) that are all due at the same moment each minute; it fires by itself, so afterEach DISABLES
//   the job, waits for a running run to end and deletes it (backups kept). One or two Full backups of the database are created.
// case-vs-ui: "12:00 (all)" is replaced by three Periodic schedules, Run every 1 minute, all days, Start at 0:00: they collide at every whole minute, so the test does not wait for a clock time.
//   The schedules are entered in the order Log, Differential, Full so that the winner cannot be the first listed one.
// case-vs-ui: "Only ONE job run is triggered and its Backup type = Full" is read from msdb.backupset (every new NAKIVO backup is type D, none is I or L, at most one per minute) and the job events
//   (no "Backup type: DIFFERENTIAL" / "LOG"); the skipped runs' message ("... skipped ... higher priority schedule #n", seen 2026-10-08) is attached as observed-outcome.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154859');
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

test('NAKIVO runs only the Full backup when Full, Differential and Log schedules are due at the same time', { tag: '@NJM-154859' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the database is in the FULL recovery model and no job named NJM-154859 exists; open Data Protection > + > Backup for Database', async () => {
    const model = await host.recoveryModel(db);
    if (model !== 'FULL' && model !== 'BULK_LOGGED') throw new Error(`ABORTED: database ${db} is in the ${model} recovery model; the Log schedule needs FULL or BULK_LOGGED`);
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });

  await test.step('2. Select the database and the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Create three schedules that fire at the same time: Log, Differential and Full (Periodic, every 1 minute) and finish the job', async () => {
    const periodic = { every: 1, unit: 'minutes' as const };
    await a6.fillSchedule(0, { name: 'log', type: 'Periodic', periodic, allDays: true, sqlBackupType: 'Log' });
    await a6.fillSchedule(1, { name: 'differential', type: 'Periodic', periodic, allDays: true, sqlBackupType: 'Differential' });
    await a6.fillSchedule(2, { name: 'full', type: 'Periodic', periodic, allDays: true, sqlBackupType: 'Full' });
    expect(await a6.scheduleCount()).toBe(3);
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'collision at 12:00 replaced by three Periodic every-1-minute schedules that collide every minute' });
  });

  await test.step('4. Wait for the collision time and monitor: the job starts by itself and the run completes', async () => {
    expect(await a6.waitRunStart(240_000), 'the job did not start by itself within 4 minutes').toBe(true);
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
  });

  await test.step('5. Only one run per due minute, and its Backup type is Full (highest priority)', async () => {
    const created = await a6.newNbrBackups(host, db, before);
    expect(created.length, 'no new NAKIVO backup of the database in msdb').toBeGreaterThan(0);
    for (const row of created) expect(row.type, `a run of type ${row.type} was made although a Full schedule was due`).toBe('D');
    const minutes = created.map((row) => row.finishedAt.slice(0, 16));
    expect(new Set(minutes).size, 'more than one backup finished in the same minute').toBe(minutes.length);
    const typeEvents = await a6.eventLines(/Backup type:/i);
    for (const line of typeEvents) expect(line).not.toMatch(/DIFFERENTIAL|LOG/i);
    const skipped = await a6.eventLines(/skipped|higher priority/i);
    testInfo.annotations.push({ type: 'observed-outcome', description: `type events: ${typeEvents.join(' | ')}; skipped-run events: ${skipped.join(' | ')}` });
  });
});
