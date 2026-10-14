import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-171437: "Backup - Step 3 - Schedule - After another job".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates TWO jobs: NJM-171437-parent (on demand, the "preceding job") and NJM-171437 (schedule "After another job" = the parent); runs the parent once, which starts the child by itself.
//   Two backups of the database are created (one per job); afterEach deletes both jobs (backups kept).
// case-vs-ui: the case says a second job "exists": it does not exist in the lab, so the test creates it (on demand, same database and repository) and removes it afterwards.
// case-vs-ui: the schedule is the inline block; the Parent job combo is a grid/div popup, picked by its job name. "Run this job: Immediately | Delayed" and "After successful / failed / stopped runs"
//   are left at their defaults.
// UNVERIFIED: the Parent job input is found as the input after the label "Parent job" (pages/bkA6-schedule.page.ts parentJobInput).
test.use(RUN_OPTIONS);

const CHILD = backupJobName('NJM-171437');
const PARENT = backupJobName('NJM-171437', '-parent');
const created = new Set<string>();

test.afterEach(async ({ page, backupFlows }) => {
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  for (const name of [CHILD, PARENT]) {
    if (!created.has(name)) continue;
    try {
      await a6.retireJob(name);
    } catch {
      // Best effort: the original failure is what the report shows.
    }
  }
  created.clear();
});

test('NAKIVO starts a database backup job automatically after its preceding job completes (schedule After another job)', { tag: '@NJM-171437' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the database is in Inventory, the repository is Online and selectable, and no job named NJM-171437 or NJM-171437-parent exists', async () => {
    for (const name of [CHILD, PARENT]) {
      if (await backupFlows.jobExists(name)) throw new Error(`ABORTED: a job named ${name} already exists; delete it and run again`);
    }
    before = await host.backupHistory(db, 50);
  });

  await test.step('2. Precondition: create the preceding job NJM-171437-parent (on demand) so it exists and is runnable', async () => {
    await a6.createJob({ name: PARENT, item: source.item, db, repo, schedules: [] });
    created.add(PARENT);
    expect(await backupFlows.jobExists(PARENT)).toBe(true);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'the preceding job did not exist; the test creates NJM-171437-parent on demand' });
  });

  await test.step('3. Open Data Protection > + > Backup for Database, select the database and the repository and go to the Schedule step', async () => {
    await a6.openScheduleStep(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('4. Set the schedule type to "After another job" and select the preceding job: the schedule is accepted with the parent as the trigger', async () => {
    await a6.fillSchedule(0, { name: 'after parent', type: 'After another job', parentJob: PARENT });
    await expect(a6.ui.typeInput(0)).toHaveValue('After another job');
    await expect(a6.ui.parentJobInput(0)).toHaveValue(PARENT);
  });

  await test.step('5. Finish the job, then run the preceding job: the preceding job runs and completes', async () => {
    await backupFlows.next();
    await backupFlows.setJobName(CHILD);
    await a6.finish('finish');
    created.add(CHILD);
    await backupFlows.openJob(PARENT);
    await backupFlows.runOpenJob();
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
  });

  await test.step('6. After the preceding job finishes, the SQL backup job starts automatically and creates a recovery point in the repository', async () => {
    await backupFlows.openJob(CHILD);
    expect(await a6.waitRunStart(240_000, true), `${CHILD} did not start after ${PARENT} completed`).toBe(true);
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    await expect(page.getByText(repo, { exact: false }).filter({ visible: true }).first()).toBeVisible();
    const backups = await a6.newNbrBackups(host, db, before);
    expect(backups.length, 'fewer than two new NAKIVO backups in msdb (parent and child)').toBeGreaterThanOrEqual(2);
  });

  await test.step('Ad hoc: the saved child schedule is "After another job" with the parent selected (Edit wizard, then Cancel)', async () => {
    await a6.openEditSchedule(CHILD);
    expect((await a6.readSchedule(0)).type).toBe('After another job');
    await expect(a6.ui.parentJobInput(0)).toHaveValue(PARENT);
    await a6.closeEditor();
  });
});
