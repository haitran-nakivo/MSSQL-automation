import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupValue } from '../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../flows/bkA2-wizard.flows';

// NJM-154736: "Verify AG Backup Capability" ([Scope: Gen Req] the databases of a discovered Availability Group can be backed up).
// Env (.env, owner-supplied): NAKIVO_BK_AG_ITEM (Inventory item of the AG), NAKIVO_BK_AG_DB_FULL (a database of the AG; AG databases are FULL recovery). A missing value ends the spec ABORTED.
// Side effects: none (the wizard is opened, a database is ticked and the wizard is cancelled).
// case-vs-ui: "Jobs > Create > Microsoft SQL Server backup job" is Data Protection > + > Backup for Database; the AG node is already expanded in the Source tree (an AG lists user databases only).
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO lists the databases of an Availability Group on the Source step and lets the user select each of them for backup', { tag: '@NJM-154736' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupWizardPage }) => {
  test.setTimeout(300_000);
  const item = readBackupValue('AG_ITEM');
  const db = readBackupDatabase('AG', 'FULL');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the Availability Group is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(item))) throw new Error(`ABORTED: the Inventory item "${item}" is not listed`);
  });

  await test.step('2. Open Data Protection > + > Backup for Database: the wizard opens on the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupWizardPage.title).toContainText('Backup Job Wizard for Database');
    expect(await wiz.onSourceStep()).toBe(true);
  });

  await test.step('3. The AG node shows its child databases', async () => {
    await expect(backupWizardPage.treeRow(item)).toBeVisible();
    await expect(backupWizardPage.treeRow(db)).toBeVisible();
  });

  await test.step('4. A child database of the AG is individually selectable for backup', async () => {
    await backupFlows.selectSources([{ item, databases: [db] }]);
    expect(await wiz.sourceSummaryText()).not.toContain('Select at least one item on the left');
    await expect(backupWizardPage.nextButton).toBeVisible();
  });
});
