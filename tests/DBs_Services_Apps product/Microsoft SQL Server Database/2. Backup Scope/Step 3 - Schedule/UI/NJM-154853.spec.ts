import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154853: "[MSSQL-BK-UI-Sche-0004] Verify Schedule Card UI".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: creates job NJM-154853 with one Weekly schedule (Mon-Fri, 0:00; it is not run) and deletes it in afterEach.
// case-vs-ui: 11.2.1 has no Schedule card and no schedule list: a schedule is an inline block, and the saved schedule is shown on the job page as a summary sentence ("Runs once a day on Monday
//   through Friday, Starting at 0:00 ..."), status "Waiting on schedule". Those two places are asserted instead of a card. The Figma mockup cannot be compared by a script.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154853');
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

test('NAKIVO shows a saved schedule on the job page and in the schedule block of the Edit wizard (no schedule card in 11.2.1)', { tag: '@NJM-154853' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(600_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const a6 = new BkA6ScheduleFlows(page, backupFlows);

  await test.step('1. Precondition: no job named NJM-154853 exists; open Data Protection > + > Backup for Database', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });

  await test.step('2. Select the database and the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Create and save a schedule (name "weekday backup", Weekly), then observe where it is listed', async () => {
    await a6.fillSchedule(0, { name: 'weekday backup' });
    await expect(a6.ui.nameInput(0)).toHaveValue('weekday backup');
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible();
    const lines = await a6.scheduleLines();
    testInfo.annotations.push({ type: 'observed-outcome', description: `job page schedule lines: ${lines.join(' | ')}` });
    expect(lines.length, 'the job page shows no schedule summary').toBeGreaterThan(0);
    await expect(page.getByText('Waiting on schedule', { exact: false }).filter({ visible: true }).first()).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'no schedule Card in 11.2.1; the saved schedule is the job page summary and the inline block in Edit' });
  });

  await test.step('4. Compare the saved schedule with the design (Figma not comparable by script): the Edit wizard shows the same schedule block with the saved name', async () => {
    await a6.openEditSchedule(JOB);
    const state = await a6.readSchedule(0);
    expect(state.name).toBe('weekday backup');
    expect(state.type).toBe('Weekly');
    await a6.closeEditor();
  });
});
