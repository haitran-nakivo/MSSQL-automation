import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154841: "[DBM-BK-UI-Schedule-0002] Verify Schedule Card Existence".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: none (the wizard is opened and left without saving a job).
// case-vs-ui: 11.2.1 has NO Schedule card and no Add/Edit schedule button: the schedule is an inline block "Schedule #1" (Name, Type, days, Start at, Keep backups for, SQL backup type)
//   with an "Add another schedule" link (and a "Remove" link on added blocks) and a "Show calendar" link. The inline block is asserted as the card's equivalent.
test.use(RUN_OPTIONS);

test('NAKIVO shows the schedule as an inline Schedule #1 block with its controls on the Schedule step', { tag: '@NJM-154841' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
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
    await expect(backupWizardPage.onDemandCheckbox).toBeVisible();
  });

  await test.step('3. Locate the main schedule container on the step: the "Schedule #1" block is present and visible', async () => {
    await expect(a6.ui.header(0)).toBeVisible();
    await expect(a6.ui.block(0)).toBeVisible();
    await expect(a6.ui.typeInput(0)).toHaveValue('Weekly');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'no Schedule card in 11.2.1; the inline Schedule #1 block is the schedule container' });
  });

  await test.step('4. Verify the block exposes the schedule parameters and the add controls (Add another schedule, Show calendar)', async () => {
    await expect(a6.ui.nameInput(0)).toBeVisible();
    await expect(a6.ui.startAtInput(0)).toBeVisible();
    await expect(a6.ui.keepCountInput(0)).toBeVisible();
    await expect(a6.ui.sqlTypeInput(0)).toBeVisible();
    await expect(a6.ui.addScheduleLink).toBeVisible();
    await expect(a6.ui.showCalendarLink).toBeVisible();
  });

  await test.step('Ad hoc (negative): "Do not schedule, run on demand" hides the schedule block and unticking it brings it back', async () => {
    await backupFlows.setOnDemand();
    await expect(a6.ui.header(0)).toBeHidden();
    await backupFlows.setOnDemand();
    await expect(a6.ui.header(0)).toBeVisible();
  });
});
