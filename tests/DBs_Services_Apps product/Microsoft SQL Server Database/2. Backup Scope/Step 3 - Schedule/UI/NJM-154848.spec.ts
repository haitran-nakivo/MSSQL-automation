import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154848: "[MSSQL-BK-UI-Sche-0003-4] Verify Dropdown Options".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: none (the wizard is opened and left without saving a job).
// case-vs-ui: no Create Schedule dialog in 11.2.1; the dropdown is in the inline Schedule #1 block. The list is closed again by re-picking Full, so the value is unchanged.
test.use(RUN_OPTIONS);

test('NAKIVO lists exactly Full, Differential and Log in the SQL backup type dropdown', { tag: '@NJM-154848' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let options: string[] = [];

  await test.step('1. Precondition: open Data Protection > + > Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupWizardPage.title).toBeVisible();
  });

  await test.step('2. Select a database, go to Destination, select the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.sqlTypeInput(0)).toBeVisible();
  });

  await test.step('3. Click the SQL backup type dropdown: it expands and shows its list', async () => {
    options = await a6.comboOptions(a6.ui.sqlTypeInput(0), 'Full');
    expect(options.length, 'the dropdown shows no options').toBeGreaterThan(0);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'no Create Schedule dialog in 11.2.1; the dropdown is in the inline Schedule #1 block' });
  });

  await test.step('4. Verify the options: exactly Full, Differential and Log', async () => {
    expect(options).toEqual(['Full', 'Differential', 'Log']);
    await expect(a6.ui.sqlTypeInput(0)).toHaveValue('Full');
  });

  await test.step('Ad hoc: the dropdown of a second schedule offers the same options', async () => {
    await a6.ui.addScheduleLink.click({ timeout: 10_000 });
    await expect(a6.ui.header(1)).toBeVisible();
    expect(await a6.comboOptions(a6.ui.sqlTypeInput(1), 'Full')).toEqual(['Full', 'Differential', 'Log']);
  });
});
