import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154845: "[MSSQL-BK-UI-Sche-0003] Verify SQL Backup Type Dropdown Existence".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: none (the wizard is opened and left without saving a job).
// case-vs-ui: no Create Schedule dialog in 11.2.1; the "SQL backup type" dropdown sits in the inline Schedule #1 block (and in every block added with "Add another schedule").
test.use(RUN_OPTIONS);

test('NAKIVO shows the SQL backup type dropdown in the schedule', { tag: '@NJM-154845' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
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

  await test.step('3. Open the schedule editor (the inline Schedule #1 block; no dialog in 11.2.1)', async () => {
    await expect(a6.ui.block(0)).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'no Create Schedule dialog in 11.2.1; the schedule is inline in Step 3' });
  });

  await test.step('4. Locate the "SQL backup type" dropdown: it is visible', async () => {
    await expect(a6.ui.sqlTypeLabel(0)).toBeVisible();
    await expect(a6.ui.sqlTypeInput(0)).toBeVisible();
  });

  await test.step('Ad hoc: a schedule added with "Add another schedule" has its own SQL backup type dropdown', async () => {
    await a6.ui.addScheduleLink.click({ timeout: 10_000 });
    await expect(a6.ui.header(1)).toBeVisible();
    await expect(a6.ui.sqlTypeInput(1)).toBeVisible();
  });
});
