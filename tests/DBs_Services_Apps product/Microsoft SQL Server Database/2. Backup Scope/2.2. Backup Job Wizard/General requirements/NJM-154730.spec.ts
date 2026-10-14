import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupValue } from '../../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../../flows/bkA2-wizard.flows';

// NJM-154730: "[DBM-Creat Job-UI-0002] Verify Opening the Wizard".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL.
// Side effects: none (the wizard is opened and cancelled).
// case-vs-ui: Jobs > Create is Data Protection > "+"; the first step is called Source (the case says Databases).
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO opens the New Backup Job Wizard for Database on the Source step, listing the databases of the inventoried SQL Server item', { tag: '@NJM-154730' }, async ({ signedIn: _s, page, backupFlows, backupJobPage, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the SQL Server item is in Inventory (checked on the wizard\'s Source tree in step 3)', async () => {
    await backupFlows.gotoJobs();
  });

  await test.step('2. Open Data Protection > + and click "Backup for Database": the option is clickable', async () => {
    await backupJobPage.addButton.click({ timeout: 10_000 });
    await expect(backupJobPage.backupForDatabaseItem).toBeVisible();
    await backupJobPage.backupForDatabaseItem.click({ timeout: 10_000 });
  });

  await test.step('3. The wizard opens on its first step (Source)', async () => {
    await expect(backupWizardPage.title).toBeVisible({ timeout: 30_000 });
    await expect(backupWizardPage.title).toContainText('New Backup Job Wizard for Database');
    expect(await wiz.onSourceStep()).toBe(true);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The first step is named Source (case: Databases).' });
  });

  await test.step('4. The Source step lists the databases of the SQL Server item, ready for selection', async () => {
    if ((await backupWizardPage.treeCheckbox(item).count()) === 0) throw new Error(`ABORTED: the Inventory item "${item}" is not listed in the wizard's Source tree`);
    await expect(backupWizardPage.treeRow(item)).toBeVisible();
    await expect(backupWizardPage.treeRow(db)).toBeVisible();
    await expect(backupWizardPage.treeCheckbox(db)).toBeVisible();
  });

  await test.step('Ad hoc (negative): tempdb is not offered for backup', async () => {
    await expect(page.getByText('tempdb', { exact: true }).filter({ visible: true })).toHaveCount(0);
  });
});
