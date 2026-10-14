import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-171438: "Backup - Step 3 - Schedule - All schedule: Check priority of schedule".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-171438 with THREE schedules: Weekly (Full), Periodic every 1 minute (Differential) and Periodic every 1 minute (Full); the two Periodic ones collide every minute. The job
//   fires by itself, so afterEach DISABLES it, waits for a running run to end and deletes it (backups kept). One or two Full backups of the database are created.
// case-vs-ui: the case lists "Weekly + Period + fixed-time" schedules that can coincide at a real clock time. A coincidence of a Weekly slot cannot be arranged without waiting for it, so the colliding
//   pair is two Periodic every-1-minute schedules (due at the same whole minute); the Weekly schedule is saved on the job as the third schedule ("all schedules saved"). "Prioritize schedules" (default ticked)
//   and its tooltip (higher priority wins, overlapping lower-priority schedules are skipped) are asserted. The priority outcome is read from msdb: one backup per minute at most, all of type Full (D).
// case-vs-ui: the schedule is the inline block, not a dialog; "specific-time schedule" is the Weekly schedule at Start at 3:15.
// UNVERIFIED: the Prioritize schedules info icon (qmMain after the label) and the exact tooltip wording (the notes: "Yearly > Monthly ... overlapping lower priority schedules are skipped").
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-171438');
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

test('NAKIVO saves several schedules on one job and runs only one backup when two of them are due at the same time', { tag: '@NJM-171438' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the database is in Inventory, the repository is Online and selectable, no job named NJM-171438 exists', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
  });

  await test.step('2. Open Data Protection > + > Backup for Database, select the database and the repository and go to the Schedule step', async () => {
    await a6.openScheduleStep(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Configure several schedules: Weekly (Start at 3:15), Periodic every 1 minute (Differential), Periodic every 1 minute (Full)', async () => {
    const periodic = { every: 1, unit: 'minutes' as const };
    await a6.fillSchedule(0, { name: 'weekly', type: 'Weekly', startAt: '3:15' });
    await a6.fillSchedule(1, { name: 'periodic differential', type: 'Periodic', periodic, allDays: true, sqlBackupType: 'Differential' });
    await a6.fillSchedule(2, { name: 'periodic full', type: 'Periodic', periodic, allDays: true, sqlBackupType: 'Full' });
    expect(await a6.scheduleCount()).toBe(3);
    expect(await a6.isTicked(backupFlows.wizard.prioritizeSchedulesCheckbox), '"Prioritize schedules" is not ticked by default').toBe(true);
    const tip = (await a6.hoverTexts(a6.ui.prioritizeInfoIcon)).join(' ');
    testInfo.annotations.push({ type: 'observed-outcome', description: `Prioritize schedules tooltip: "${tip}"` });
    expect(tip, 'the Prioritize schedules tooltip does not mention Yearly / Monthly priority').toMatch(/Yearly/i);
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible();
  });

  await test.step('3b. All configured schedules are saved on the job (Edit wizard shows three schedules)', async () => {
    await a6.openEditSchedule(JOB);
    expect(await a6.scheduleCount()).toBe(3);
    expect((await a6.readSchedule(0)).type).toBe('Weekly');
    expect((await a6.readSchedule(1)).type).toBe('Periodic');
    expect((await a6.readSchedule(2)).type).toBe('Periodic');
    await a6.closeEditor();
    await backupFlows.openJob(JOB);
  });

  await test.step('4. Two schedules become due at the same time (both Periodic schedules, every whole minute): the job starts by itself', async () => {
    expect(await a6.waitRunStart(240_000), 'the job did not start by itself within 4 minutes').toBe(true);
  });

  await test.step('5. Only one run is triggered per due window and the higher-priority (Full) schedule wins: no duplicate run, no Differential', async () => {
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    const created = await a6.newNbrBackups(host, db, before);
    expect(created.length, 'no new NAKIVO backup of the database in msdb').toBeGreaterThan(0);
    for (const row of created) expect(row.type, `a backup of type ${row.type} ran although a Full schedule was due`).toBe('D');
    const minutes = created.map((row) => row.finishedAt.slice(0, 16));
    expect(new Set(minutes).size, 'more than one backup finished in the same minute').toBe(minutes.length);
    const skipped = await a6.eventLines(/skipped|higher priority/i);
    testInfo.annotations.push({ type: 'observed-outcome', description: `skipped-run events: ${skipped.join(' | ')}` });
  });

  await test.step('6. A single recovery point was created for the coinciding trigger and the job keeps all three schedules', async () => {
    const created = await a6.newNbrBackups(host, db, before);
    const minutes = created.map((row) => row.finishedAt.slice(0, 16));
    expect(new Set(minutes).size, 'one recovery point per due minute is expected, not several').toBe(minutes.length);
    await a6.openEditSchedule(JOB);
    expect(await a6.scheduleCount()).toBe(3);
    await a6.closeEditor();
  });
});
