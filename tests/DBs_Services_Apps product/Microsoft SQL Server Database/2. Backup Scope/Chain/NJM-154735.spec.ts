import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupValue } from '../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../flows/bkA2-wizard.flows';

// NJM-154735: "Verify FCI Backup Capability" ([Scope: Gen Req] the databases of a discovered Failover Cluster Instance can be backed up).
// Env (.env, owner-supplied): NAKIVO_BK_FCI_ITEM (Inventory item of the FCI), NAKIVO_BK_FCI_DB_FULL (a database on it). A missing value ends the spec ABORTED.
// Side effects: none (the wizard is opened, a database is ticked and the wizard is cancelled).
// case-vs-ui: "Jobs > Create > Microsoft SQL Server backup job" is Data Protection > + > Backup for Database; the FCI node is already expanded in the Source tree.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO lists the databases of a Failover Cluster Instance on the Source step and lets the user select each of them for backup', { tag: '@NJM-154735' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupWizardPage }) => {
  test.setTimeout(300_000);
  const item = readBackupValue('FCI_ITEM');
  const db = readBackupDatabase('FCI', 'FULL');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the FCI is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(item))) throw new Error(`ABORTED: the Inventory item "${item}" is not listed`);
  });

  await test.step('2. Open Data Protection > + > Backup for Database: the wizard opens on the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupWizardPage.title).toContainText('Backup Job Wizard for Database');
    expect(await wiz.onSourceStep()).toBe(true);
  });

  await test.step('3. The FCI node shows its child databases', async () => {
    await expect(backupWizardPage.treeRow(item)).toBeVisible();
    await expect(backupWizardPage.treeRow(db)).toBeVisible();
  });

  await test.step('4. A child database of the FCI is individually selectable for backup', async () => {
    await backupFlows.selectSources([{ item, databases: [db] }]);
    expect(await wiz.sourceSummaryText()).not.toContain('Select at least one item on the left');
    await expect(backupWizardPage.nextButton).toBeVisible();
  });
});
