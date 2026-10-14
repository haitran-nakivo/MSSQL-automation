import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154858: "[MSSQL-BK-UI-Sche-0007] Verify Failure on Missing Full".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-154858 with a Periodic "every 1 minute" schedule of type Differential and no Full base (a new job has its own, empty target); it fires by itself, so afterEach DISABLES
//   the job, waits for a running run to end and deletes it (backups kept). At least one Full backup of the database is created by the fallback.
// case-vs-ui: the case says the run must FAIL with an error naming the missing Full. Observed on 11.2.1 (2026-10-08, memory nakivo-mssql-backup-types-spec) and stated by the newer spec key NJM-175281:
//   a Differential (or Log) run with no valid Full performs a FULL backup instead and succeeds; the db0001 notification was NOT seen. The older spec line (alarm sql2, failure) conflicts with it.
//   The UI is the baseline: this test asserts the fallback (run successful, msdb type D) and attaches any "missing / Full backup will be performed" text as observed-outcome. It fails if the run fails.
// case-vs-ui: "trigger" is a Periodic schedule, Run every 1 minute, all days, Start at 0:00. There is no Create Schedule dialog.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154858');
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

test('NAKIVO performs a Full backup instead of failing when only a Differential schedule runs and no Full backup exists', { tag: '@NJM-154858' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: no job named NJM-154858 exists (a new job has no Full backup); open Data Protection > + > Backup for Database', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });

  await test.step('2. Select the database and the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Schedule only a Differential run (Periodic, every 1 minute) for a job with no base Full backup and finish the job', async () => {
    await a6.fillSchedule(0, { name: 'every minute', type: 'Periodic', periodic: { every: 1, unit: 'minutes' }, allDays: true, sqlBackupType: 'Differential' });
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible();
  });

  await test.step('4. Wait for the schedule to trigger and monitor the run: the job starts by itself', async () => {
    expect(await a6.waitRunStart(240_000), 'the scheduled job did not start by itself within 4 minutes').toBe(true);
  });

  await test.step('5. The run does not fail: a Full backup is performed because no base Full exists (observed behaviour, not the case text)', async () => {
    const outcome = await backupFlows.waitForResult(600_000);
    const notes = await a6.eventLines(/missing|corrupted|Full backup|Cannot perform|Backup type:/i);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'case expects a failure naming the missing Full; 11.2.1 performs a Full backup instead (no db0001 notification seen)' });
    testInfo.annotations.push({ type: 'observed-outcome', description: `job outcome: ${outcome}; related job events: ${notes.join(' | ')}` });
    expect(outcome, 'the Differential run with no Full base failed instead of falling back to a Full backup').toBe('successful');
    const created = await a6.newNbrBackups(host, db, before);
    expect(created.length, 'no new NAKIVO backup of the database in msdb').toBeGreaterThan(0);
    expect(created[0].type, 'the fallback backup is not a Full backup (msdb type D)').toBe('D');
  });
});
