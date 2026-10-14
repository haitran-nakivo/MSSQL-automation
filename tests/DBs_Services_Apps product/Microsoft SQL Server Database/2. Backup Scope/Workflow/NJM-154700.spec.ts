import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupValue } from '../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../flows/bkA2-wizard.flows';

// NJM-154700: "[MSSQL-BK-WF-0001] Verify Source Step Selection".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL.
// Side effects: none (the wizard is opened, a database ticked, Next clicked and the wizard cancelled).
// case-vs-ui: "Jobs > Create > Microsoft SQL Server backup job" is Data Protection > + > Backup for Database; "Databases (Source)" is the Source step; the instance node is already expanded.
//   The selection pane is the right-hand panel ("Select at least one item on the left" -> "N item(s)..." / the selected database row).
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO user selects a SQL database on the Source step and Next becomes available', { tag: '@NJM-154700' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupWizardPage }) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the SQL Server instance is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(item))) throw new Error(`ABORTED: the Inventory item "${item}" is not listed`);
  });

  await test.step('2. Start Create > Backup for Database: the wizard opens on the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupWizardPage.title).toContainText('Backup Job Wizard for Database');
    expect(await wiz.onSourceStep()).toBe(true);
  });

  await test.step('3. The databases of the instance are listed', async () => {
    await expect(backupWizardPage.treeRow(item)).toBeVisible();
    await expect(backupWizardPage.treeRow(db)).toBeVisible();
  });

  await test.step('Ad hoc (negative): before a selection the pane asks for one and Next does not leave the step', async () => {
    expect(await wiz.sourceSummaryText()).toContain('Select at least one item on the left');
    await backupFlows.next({ blocked: true });
    expect(await wiz.onDestinationStep()).toBe(false);
  });

  await test.step('4. Select the target database: it is shown in the selection pane and Next moves to Destination', async () => {
    await backupFlows.selectSources([{ item, databases: [db] }]);
    expect(await wiz.sourceSummaryText()).not.toContain('Select at least one item on the left');
    await expect(page.getByText(db, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await backupFlows.next();
    expect(await wiz.onDestinationStep()).toBe(true);
  });
});
