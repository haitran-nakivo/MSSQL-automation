import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154854: "[MSSQL-BK-UI-Sche-0005] Verify Selected Type Display in Card".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: creates job NJM-154854 with one Weekly schedule of SQL backup type Log (not run) and deletes it in afterEach.
// case-vs-ui: no Schedule card in 11.2.1. The selected type is displayed by the "SQL backup type" field of the inline schedule block (asserted before saving and again in the Edit wizard after saving).
//   Whether the job page summary also names the type is not in the notes: its schedule lines are attached as observed-outcome, not asserted.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154854');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try {
    await backupFlows.discardJobIfPresent(JOB);
  } catch {
    // Best effort: the original failure is what the report shows.
  }
  jobCreated = false;
});

test('NAKIVO displays the selected SQL backup type Log in the saved schedule', { tag: '@NJM-154854' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(600_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const a6 = new BkA6ScheduleFlows(page, backupFlows);

  await test.step('1. Precondition: no job named NJM-154854 exists; open Data Protection > + > Backup for Database', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });

  await test.step('2. Select the database and the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Create a schedule with SQL backup type Log and save it: the schedule keeps the type', async () => {
    await a6.fillSchedule(0, { name: 'log schedule', sqlBackupType: 'Log' });
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Log');
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible();
  });

  await test.step('4. Inspect the schedule for the backup-type field: the SQL backup type shows Log (Edit wizard, saved schedule)', async () => {
    testInfo.annotations.push({ type: 'observed-outcome', description: `job page schedule lines: ${(await a6.scheduleLines()).join(' | ')}` });
    await a6.openEditSchedule(JOB);
    await expect(a6.ui.sqlTypeLabel(0)).toBeVisible();
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Log');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'no Schedule card in 11.2.1; the type is shown by the SQL backup type field of the schedule block' });
    await a6.closeEditor();
  });
});
