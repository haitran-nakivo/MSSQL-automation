import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../../flows/bkA2-wizard.flows';

// NJM-154729: "[DBM-Creat Job-UI-0001] Verify Create Job Menu Option".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM (an existing Inventory item).
// Side effects: none (the Create menu is opened and closed).
// case-vs-ui: the case says "Jobs view > Create > Microsoft SQL Server database backup job" and "Backup for databases"; the UI is Data Protection > "+" >
//   "Backup for Database" (the entry sits in the Backup Job group with the other platforms).
test.use(RUN_OPTIONS);

test('NAKIVO Create menu offers an enabled "Backup for Database" entry when a SQL Server item is in Inventory', { tag: '@NJM-154729' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupJobPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the SQL Server item is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(item))) throw new Error(`ABORTED: the Inventory item "${item}" is not listed`);
  });

  await test.step('2. Open Data Protection and click "+": the Create menu opens', async () => {
    await backupFlows.gotoJobs();
    await backupJobPage.addButton.click({ timeout: 10_000 });
    await expect(backupJobPage.backupForDatabaseItem).toBeVisible();
  });

  await test.step('3. The database backup entry is present in the menu', async () => {
    await expect(backupJobPage.backupForDatabaseItem).toHaveText('Backup for Database');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Entry text is "Backup for Database" (case: "Microsoft SQL Server database backup job" / "Backup for databases").' });
  });

  await test.step('4. The entry is enabled (not greyed) and selectable', async () => {
    expect(await backupFlows.isDisabled(backupJobPage.backupForDatabaseItem)).toBe(false);
    await wiz.closeMenu();
  });

  await test.step('Ad hoc: the entry is selectable, it opens the wizard', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
    await wiz.cancelAndConfirm();
  });
});
