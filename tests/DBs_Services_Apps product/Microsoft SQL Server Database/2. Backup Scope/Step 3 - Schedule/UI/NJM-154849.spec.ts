import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154849: "[MSSQL-BK-UI-Sche-0003-5] Verify Default Selection".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: none (the wizard is opened and left without saving a job).
// case-vs-ui: no Create Schedule dialog in 11.2.1; the default is read from the inline Schedule #1 block and from a block added with "Add another schedule".
test.use(RUN_OPTIONS);

test('NAKIVO selects Full by default in the SQL backup type of a new schedule', { tag: '@NJM-154849' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
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
    await expect(a6.ui.sqlTypeInput(0)).toBeVisible();
  });

  await test.step('3. Observe the default SQL backup type value: Full is selected', async () => {
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Full');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'no Create Schedule dialog in 11.2.1; the default is read in the inline Schedule #1 block' });
  });

  await test.step('Ad hoc: a schedule added with "Add another schedule" also defaults to Full, and changing Schedule #1 does not change it', async () => {
    await a6.fillSchedule(0, { sqlBackupType: 'Log' });
    await a6.ui.addScheduleLink.click({ timeout: 10_000 });
    await expect(a6.ui.header(1)).toBeVisible();
    await expect(a6.ui.sqlTypeInput(1)).toHaveValue('Full');
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Log');
  });
});
