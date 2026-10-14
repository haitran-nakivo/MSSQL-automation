import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5ActionsFlows } from '../../../../../../flows/bkA5-actions.flows';

// NJM-171467: "[DBM-BK-UI-Actions-0002-2] It shall not display the 'Truncate SQL Server logs' checkbox".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case has a separate "Step 4/Step 5 - Actions" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options.
test.use(RUN_OPTIONS);

test('NAKIVO does not show a Truncate SQL Server logs checkbox for a database backup job', { tag: '@NJM-171467' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const actions = new BkA5ActionsFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case has a separate \"Step 4/Step 5 - Actions\" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  await test.step('1. Open Data Protection, click + and choose Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });
  await test.step('2. Advance through Source, Destination and Schedule (run on demand) until the Options step, which holds the Actions controls, is displayed', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await backupFlows.chooseDestination(repo);
    await backupFlows.next();
    await backupFlows.setOnDemand();
    await backupFlows.next();
    await expect(backupFlows.wizard.jobNameField).toBeVisible();
    await expect(actions.o.reportLabel()).toBeVisible();
  });
  await test.step('3. Inspect the Actions controls for a "Truncate SQL Server logs" checkbox: it is NOT displayed', async () => {
    await expect(actions.o.scriptLabel('pre'), 'the Options step is not the one with the Actions controls').toBeVisible();
    await expect(actions.o.forbiddenCheckbox(/Truncate (SQL Server|SQL) logs/i)).toHaveCount(0);
  });
  await test.step('Ad hoc: the control is also absent on the Schedule step', async () => {
    await backupFlows.goToStep('Schedule');
    await expect(actions.o.keepBackupsLabel()).toBeVisible();
    await expect(actions.o.forbiddenCheckbox(/Truncate (SQL Server|SQL) logs/i)).toHaveCount(0);
  });
});
