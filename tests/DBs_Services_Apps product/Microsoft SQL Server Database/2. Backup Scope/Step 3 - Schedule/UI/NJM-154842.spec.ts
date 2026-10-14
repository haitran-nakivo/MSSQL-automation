import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154842: "[DBM-BK-UI-Schedule-0003] Verify Standard Schedule Behaviors".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: none (the wizard is opened and left without saving a job).
// case-vs-ui: the UI has no "Daily" frequency: Type is Weekly | Monthly | Yearly | Periodic | After another job. "Daily" is Weekly with every weekday ticked (the "All days" link),
//   with "Start at" as its start time. The schedule editor is the inline block, not a dialog.
// case-vs-ui: there is no Enabled/Disabled switch on the schedule: the toggle is "Do not schedule, run on demand" (ticked = no schedule, the section is hidden). Disabling a saved job is Manage > Disable.
// UNVERIFIED: the weekday checkboxes are found as labels starting with Mon..Sun and their state is read from the Ext checkbox (aria-checked / checked / class).
test.use(RUN_OPTIONS);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

test('NAKIVO accepts Daily-like and Weekly schedule settings and toggles scheduling on and off', { tag: '@NJM-154842' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const a6 = new BkA6ScheduleFlows(page, backupFlows);

  await test.step('1. Precondition: open Data Protection > + > Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupWizardPage.title).toBeVisible();
  });

  await test.step('2. Select a database, go to Destination, select the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Configure a Daily schedule with a start time (Weekly, "All days", Start at 1:30): the inputs are accepted', async () => {
    await a6.fillSchedule(0, { type: 'Weekly', allDays: true, startAt: '1:30' });
    await expect(a6.ui.typeInput(0)).toHaveValue('Weekly');
    await expect(a6.ui.startAtInput(0)).toHaveValue('1:30');
    for (const day of DAYS) {
      expect(await a6.isTicked(a6.ui.dayLabel(0, day)), `${day} is not ticked after "All days"`).toBe(true);
    }
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'no Daily frequency in 11.2.1; Daily is Weekly with all 7 days ticked' });
  });

  await test.step('4. Change to Weekly with specific weekdays (Work days: Mon-Fri): the selection is accepted', async () => {
    await a6.ui.block(0).getByText('Work days', { exact: true }).filter({ visible: true }).first().click({ timeout: 10_000 });
    for (const day of DAYS.slice(0, 5)) expect(await a6.isTicked(a6.ui.dayLabel(0, day)), `${day} is not ticked after "Work days"`).toBe(true);
    for (const day of DAYS.slice(5)) expect(await a6.isTicked(a6.ui.dayLabel(0, day)), `${day} is ticked after "Work days"`).toBe(false);
    await expect(a6.ui.everyWeeksInput(0)).toHaveValue('1');
  });

  await test.step('5. Toggle scheduling: "Do not schedule, run on demand" hides the schedule, unticking it shows the schedule again with its values', async () => {
    await backupFlows.setOnDemand();
    await expect(a6.ui.header(0)).toBeHidden();
    await backupFlows.setOnDemand();
    await expect(a6.ui.header(0)).toBeVisible();
    await expect(a6.ui.typeInput(0)).toHaveValue('Weekly');
    await expect(a6.ui.startAtInput(0)).toHaveValue('1:30');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'the Enabled/Disabled toggle is the "Do not schedule, run on demand" checkbox' });
  });

  await test.step('Ad hoc (negative): the wizard is cancelled and no job is created', async () => {
    await a6.closeEditor();
    await expect(backupWizardPage.title).toBeHidden({ timeout: 15_000 });
  });
});
