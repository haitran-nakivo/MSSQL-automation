import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../flows/bkA2-wizard.flows';

// NJM-154704: "[MSSQL-BK-WF-0005] Verify Data Stream Allocation" (the number of data streams, up to 64).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (the wizard is walked to Options and cancelled).
// case-vs-ui: the control is the Options checkbox "Limit data backup to N concurrent streams" (default 1; the number is enabled only after the checkbox is ticked). Rules recorded in the notes
//   (2026-10-08): required, minimum 1, maximum 64, digits only; the invalid state is aria-invalid="true" on the field.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO Options step lets the user set the number of data streams from 1 up to 64', { tag: '@NJM-154704' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupWizardPage }) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);
  const field = backupWizardPage.concurrentStreamsField();

  await test.step('1. Precondition: the SQL Server instance is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(item))) throw new Error(`ABORTED: the Inventory item "${item}" is not listed`);
  });

  await test.step('2. Start Create > Backup for Database, select the database and the repository, proceed to Options', async () => {
    await wiz.walkTo('Options', { item, databases: [db], repo });
    expect(await wiz.onOptionsStep()).toBe(true);
  });

  await test.step('3. Locate the data streams setting: the checkbox is there, the count is disabled until it is ticked and defaults to 1', async () => {
    await expect(backupWizardPage.optionCheckbox('Limit data backup to')).toBeVisible();
    expect(await backupFlows.isDisabled(field)).toBe(true);
    await expect(field).toHaveValue('1');
  });

  await test.step('4. Set the number of streams: 3 and the maximum 64 are accepted', async () => {
    await wiz.setStreamLimit('3');
    expect(await backupFlows.isDisabled(field)).toBe(false);
    await expect(field).toHaveValue('3');
    expect(await backupFlows.isInvalid(field)).toBe(false);
    await wiz.setStreamLimit('64');
    await expect(field).toHaveValue('64');
    expect(await backupFlows.isInvalid(field)).toBe(false);
  });

  await test.step('Ad hoc (negative): 65 and 0 are flagged invalid', async () => {
    await wiz.setStreamLimit('65');
    expect(await backupFlows.isInvalid(field), '65 streams should be invalid').toBe(true);
    await wiz.setStreamLimit('0');
    expect(await backupFlows.isInvalid(field), '0 streams should be invalid').toBe(true);
  });
});
