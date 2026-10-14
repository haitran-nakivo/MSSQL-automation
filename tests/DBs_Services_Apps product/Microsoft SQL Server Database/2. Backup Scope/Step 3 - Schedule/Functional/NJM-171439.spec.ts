import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-171439: "Backup - Step 3 - Schedule - Start at/End at/Effective from".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates TWO jobs, both Periodic every 1 minute: NJM-171439 (Start at 1:00, end at 5:00, Effective from TOMORROW: it must not run) and NJM-171439-b (no effective date, starts now:
//   it must run); the second job fires by itself, so afterEach DISABLES it, waits for a running run to end and deletes both jobs (backups kept). One or more Full backups are created by NJM-171439-b.
// case-vs-ui: "advance time" (steps 5-6) cannot be done. Step 5 is checked for real: the job with Effective from tomorrow stays idle for 2.5 minutes although its Periodic schedule is due every minute.
//   Step 6: the job without an effective date runs by itself and creates a recovery point. The Start at / End at WINDOW (runs only between 1:00 and 5:00) is NOT checked: it depends on the Director's
//   clock and time zone, which a test cannot move; only that the values are saved is asserted.
// case-vs-ui: the saved Effective-from date is not shown in the job summary (notes, 2026-10-08); it is asserted from the Edit wizard link text, and the job page schedule lines are attached as observed-outcome.
// UNVERIFIED: the "Effective from" picker (link "date", caption "The job schedule will come into effect on the selected date", day cells by number, Apply) and the "end at" checkbox / time2 field on a
//   Periodic schedule (pages/bkA6-schedule.page.ts, flows setEffectiveFrom).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-171439');
const JOB_NOW = backupJobName('NJM-171439', '-b');
const created = new Set<string>();

test.afterEach(async ({ page, backupFlows }) => {
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  for (const name of [JOB_NOW, JOB]) {
    if (!created.has(name)) continue;
    try {
      await a6.retireJob(name);
    } catch {
      // Best effort: the original failure is what the report shows.
    }
  }
  created.clear();
});

test('NAKIVO saves Start at, End at and Effective from, does not run before the Effective-from date and runs when it is reached', { tag: '@NJM-171439' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(1_500_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const monthsAhead = tomorrow.getMonth() !== today.getMonth() ? 1 : 0;
  const periodic = { every: 1, unit: 'minutes' as const };
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the database is in Inventory, the repository is Online and selectable, no job named NJM-171439 or NJM-171439-b exists', async () => {
    for (const name of [JOB, JOB_NOW]) {
      if (await backupFlows.jobExists(name)) throw new Error(`ABORTED: a job named ${name} already exists; delete it and run again`);
    }
    before = await host.backupHistory(db, 50);
  });

  await test.step('2. Open Data Protection > + > Backup for Database, select the database and the repository and go to the Schedule step', async () => {
    await a6.openScheduleStep(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Set Start at 1:00, End at 5:00 and Effective from tomorrow on a Periodic every-1-minute schedule: the values are accepted', async () => {
    await a6.fillSchedule(0, { name: 'windowed', type: 'Periodic', periodic, allDays: true, startAt: '1:00', endAt: '5:00', effectiveFrom: { day: tomorrow.getDate(), monthsAhead } });
    await expect(a6.ui.startAtInput(0)).toHaveValue('1:00');
    await expect(a6.ui.endAtInput(0)).toHaveValue('5:00');
    const effective = await a6.ui.effectiveFromLink(0).innerText();
    testInfo.annotations.push({ type: 'observed-outcome', description: `Effective from link text after choosing tomorrow (${tomorrow.toDateString()}): "${effective}"` });
    expect(effective, 'the Effective from link still shows no date').not.toBe('date');
    expect(effective).toMatch(new RegExp(`\\b${tomorrow.getDate()}\\b`));
  });

  await test.step('4. Finish the job and confirm the saved schedule window: Edit shows the start/end times and the effective-from date', async () => {
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    created.add(JOB);
    testInfo.annotations.push({ type: 'observed-outcome', description: `job page schedule lines: ${(await a6.scheduleLines()).join(' | ')}` });
    await a6.openEditSchedule(JOB);
    await expect(a6.ui.startAtInput(0)).toHaveValue('1:00');
    await expect(a6.ui.endAtInput(0)).toHaveValue('5:00');
    expect(await a6.ui.effectiveFromLink(0).innerText()).toMatch(new RegExp(`\\b${tomorrow.getDate()}\\b`));
    await a6.closeEditor();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'the job summary does not show the effective date; it is read from the Edit wizard' });
  });

  await test.step('5. Before the Effective-from date the job does not run (due every minute, watched for 2.5 minutes)', async () => {
    await backupFlows.openJob(JOB);
    expect(await a6.stayedIdle(150_000), 'the job ran before its Effective-from date').toBe(true);
    await expect(page.getByText('This job has not been executed yet', { exact: false }).filter({ visible: true }).first()).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'time cannot be advanced: the Start at/End at window is not exercised, only Effective from tomorrow' });
  });

  await test.step('6. A job with no future Effective-from date and a due schedule runs by itself and creates a recovery point in the repository', async () => {
    await a6.openScheduleStep(source.item, db, repo);
    await a6.fillSchedule(0, { name: 'effective now', type: 'Periodic', periodic, allDays: true });
    await backupFlows.next();
    await backupFlows.setJobName(JOB_NOW);
    await a6.finish('finish');
    created.add(JOB_NOW);
    expect(await a6.waitRunStart(240_000), `${JOB_NOW} did not start by itself within 4 minutes`).toBe(true);
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    const backups = await a6.newNbrBackups(host, db, before);
    expect(backups.length, 'no new NAKIVO backup of the database in msdb').toBeGreaterThan(0);
  });
});
