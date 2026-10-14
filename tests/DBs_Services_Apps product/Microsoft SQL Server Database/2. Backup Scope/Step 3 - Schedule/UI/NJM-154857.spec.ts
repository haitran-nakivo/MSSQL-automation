import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154857: "[MSSQL-BK-UI-Sche-0006] Verify Scheduled Execution".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-154857 with a Periodic "every 1 minute" schedule (SQL backup type Full); it fires by itself, so afterEach DISABLES the job, waits for a running run to end and deletes it
//   (backups kept). At least one Full backup of the database is created.
// case-vs-ui: "start at T+1 minute" is a Periodic schedule, Run every 1 minute, all days, Start at 0:00: the first run is due at the next whole minute, about T+1 minute. There is no Create Schedule dialog.
// case-vs-ui: the 11.2.1 job page and Activities are watched through the job page ("Running (" appears without a manual run); the run is judged by its result and msdb (a NAKIVO backup, device_type 7).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154857');
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

test('NAKIVO starts the configured backup by itself when the schedule is due', { tag: '@NJM-154857' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the instance is in Inventory and no job named NJM-154857 exists; open Data Protection > + > Backup for Database', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });

  await test.step('2. Select the database and the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Create a schedule due in about one minute (Periodic, every 1 minute, type Full) and finish the job: it is created and waits on its schedule', async () => {
    await a6.fillSchedule(0, { name: 'every minute', type: 'Periodic', periodic: { every: 1, unit: 'minutes' }, allDays: true });
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'T+1 minute = Periodic every 1 minute from 0:00 (next whole minute)' });
  });

  await test.step('4. Wait until the scheduled time: the job starts automatically with no manual intervention', async () => {
    expect(await a6.waitRunStart(240_000), 'the job did not start by itself within 4 minutes').toBe(true);
    await expect(page.getByText(/Running \(/).filter({ visible: true }).first()).toBeVisible();
  });

  await test.step('5. The run completes and executes the configured type (Full backup recorded in msdb)', async () => {
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    const created = await a6.newNbrBackups(host, db, before);
    expect(created.length, 'no new NAKIVO backup of the database in msdb').toBeGreaterThan(0);
    expect(created[0].type).toBe('D');
  });

  await test.step('Ad hoc: the saved schedule is a Periodic, every 1 minute, type Full schedule (Edit wizard, then Cancel keeps the job)', async () => {
    await a6.openEditSchedule(JOB);
    const state = await a6.readSchedule(0);
    expect(state.type).toBe('Periodic');
    expect(state.sqlType).toBe('Full');
    await a6.closeEditor();
    expect(await backupFlows.jobExists(JOB)).toBe(true);
  });
});
