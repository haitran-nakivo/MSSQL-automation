import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154856: "[MSSQL-BK-UI-Sche-0005-2] Verify Backup Type Value Display".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: creates job NJM-154856 with one Weekly schedule of SQL backup type Differential (not run) and deletes it in afterEach.
// case-vs-ui: no Schedule card in 11.2.1: the text "Differential" is read from the SQL backup type field of the schedule block, before saving and again from the saved schedule in the Edit wizard.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154856');
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

test('NAKIVO displays the text Differential for a schedule saved with SQL backup type Differential', { tag: '@NJM-154856' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(600_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const a6 = new BkA6ScheduleFlows(page, backupFlows);

  await test.step('1. Precondition: no job named NJM-154856 exists; open Data Protection > + > Backup for Database', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });

  await test.step('2. Select the database and the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Create a schedule with SQL backup type Differential and save it', async () => {
    await a6.fillSchedule(0, { sqlBackupType: 'Differential' });
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Differential');
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible();
  });

  await test.step('4. Read the backup-type text of the saved schedule: it is Differential', async () => {
    await a6.openEditSchedule(JOB);
    expect((await a6.readSchedule(0)).sqlType).toBe('Differential');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'no Schedule card in 11.2.1; the value is read from the SQL backup type field of the saved schedule block' });
    await a6.closeEditor();
  });
});
