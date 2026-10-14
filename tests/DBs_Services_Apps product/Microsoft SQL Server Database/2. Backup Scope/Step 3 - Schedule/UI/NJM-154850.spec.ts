import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154850: "[MSSQL-BK-UI-Sche-0005-3] Verify Full Backup Execution Logic".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-154850 with a Periodic "every 1 minute" schedule of type Full; it fires by itself, so afterEach DISABLES the job, waits for a running run to end and deletes it
//   (backups kept). At least one Full backup of the database is created in the repository.
// case-vs-ui: "trigger shortly" is a Periodic schedule, Run every 1 minute, all days, Start at 0:00 (the minimum interval) instead of a clock time. There is no Create Schedule dialog and no Schedule card.
// case-vs-ui: the recovery point "Backup type" is read from msdb.backupset of the SQL host (type D = full, device_type 7 = NAKIVO's virtual device), not from the Recover wizard.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154850');
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

test('NAKIVO runs a Full backup when a schedule of SQL backup type Full fires', { tag: '@NJM-154850' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the instance is in Inventory and no job named NJM-154850 exists; open Data Protection > + > Backup for Database', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });

  await test.step('2. Select the database and the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Create a schedule with SQL backup type Full set to trigger shortly (Periodic, every 1 minute) and finish the job', async () => {
    await a6.fillSchedule(0, { name: 'every minute', type: 'Periodic', periodic: { every: 1, unit: 'minutes' }, allDays: true, sqlBackupType: 'Full' });
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Full');
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'trigger shortly = Periodic every 1 minute (no Create Schedule dialog, no Schedule card in 11.2.1)' });
  });

  await test.step('4. Wait for the schedule to trigger: the job starts automatically, with no manual run', async () => {
    expect(await a6.waitRunStart(240_000), 'the scheduled job did not start by itself within 4 minutes').toBe(true);
  });

  await test.step('5. The job completes and the recovery point Backup type is Full', async () => {
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    const created = await a6.newNbrBackups(host, db, before);
    expect(created.length, 'no new NAKIVO backup of the database in msdb').toBeGreaterThan(0);
    expect(created[0].type, 'the first scheduled run is not a Full backup (msdb type D)').toBe('D');
  });
});
