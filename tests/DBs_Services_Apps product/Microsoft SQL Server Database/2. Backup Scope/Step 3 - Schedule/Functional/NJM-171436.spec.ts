import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-171436: "Backup - Step 3 - Schedule - Period".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-171436 with a Periodic "every 1 minute" schedule (all days); it fires by itself, so afterEach DISABLES the job, waits for a running run to end and deletes it (backups kept).
//   Two scheduled runs are waited for (about 2 to 4 minutes) to show the interval repeats; two or more backups of the database are created.
// case-vs-ui: "every N hours/minutes" is entered as 1 minute (the minimum), the real automatic trigger is awaited (this is the case that does not need a day-long wait). The unit list is minutes | hours | days.
// case-vs-ui: "next run is scheduled per the Periodic recurrence" is shown by the second automatic run starting after the first one ended; the job page next-run text is not in the notes (attached as observed-outcome).
// UNVERIFIED: the Periodic "Run every N <unit>" inputs are found as the inputs after the label "Run every" (pages/bkA6-schedule.page.ts).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-171436');
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

test('NAKIVO runs a Periodic every-1-minute schedule by itself, repeatedly, and creates recovery points in the repository', { tag: '@NJM-171436' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the database is in Inventory, the repository is Online and selectable, no job named NJM-171436 exists', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
  });

  await test.step('2. Open Data Protection > + > Backup for Database, select the database and the repository and go to the Schedule step', async () => {
    await a6.openScheduleStep(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Set the recurrence to Periodic, every 1 minute: the recurrence is accepted and its parameters are shown', async () => {
    await a6.fillSchedule(0, { name: 'every minute', type: 'Periodic', periodic: { every: 1, unit: 'minutes' }, allDays: true });
    await expect(a6.ui.typeInput(0)).toHaveValue('Periodic');
    await expect(a6.ui.runEveryInput(0)).toHaveValue('1');
    await expect(a6.ui.runEveryUnitInput(0)).toHaveValue(/minute/i);
  });

  await test.step('4. Finish creating the job and open it: the job is created and its schedule shows the Periodic recurrence', async () => {
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible();
    const lines = await a6.scheduleLines();
    testInfo.annotations.push({ type: 'observed-outcome', description: `job page schedule lines: ${lines.join(' | ')}` });
    await a6.openEditSchedule(JOB);
    expect((await a6.readSchedule(0)).type).toBe('Periodic');
    await expect(a6.ui.runEveryInput(0)).toHaveValue('1');
    await a6.closeEditor();
    await backupFlows.openJob(JOB);
  });

  await test.step('5. Wait for the next Periodic occurrence: the job triggers automatically', async () => {
    expect(await a6.waitRunStart(240_000), 'the job did not start by itself within 4 minutes').toBe(true);
  });

  await test.step('6. The first run completes successfully and creates a recovery point in the repository; the next run starts by itself one interval later', async () => {
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    await expect(page.getByText(repo, { exact: false }).filter({ visible: true }).first()).toBeVisible();
    expect(await a6.waitRunStart(240_000), 'the next Periodic run did not start by itself').toBe(true);
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    const created = await a6.newNbrBackups(host, db, before);
    expect(created.length, 'fewer than two new NAKIVO backups in msdb').toBeGreaterThanOrEqual(2);
  });
});
