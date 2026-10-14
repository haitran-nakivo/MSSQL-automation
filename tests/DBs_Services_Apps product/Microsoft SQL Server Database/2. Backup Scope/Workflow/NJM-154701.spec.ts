import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../flows/bkA2-wizard.flows';

// NJM-154701: "[MSSQL-BK-WF-0002] Verify Destination Step Selection".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (the wizard is walked to Destination, a repository is chosen and the wizard is cancelled).
// case-vs-ui: "Databases (Source)" is the Source step. The repository list is a popup of the Destination combo (not a boundlist) that closes when focus leaves. With a single repository the combo
//   would already show it; with two or more it shows "Select a target destination" (notes 2026-10-08), so the "Next is enabled" check is done after the choice.
//   The case's "repository is Online" is not shown by the wizard; its presence in the list is what is checked.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO user chooses the stream repository on the Destination step and Next becomes available', { tag: '@NJM-154701' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupWizardPage }) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the SQL Server instance is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(item))) throw new Error(`ABORTED: the Inventory item "${item}" is not listed`);
  });

  await test.step('2. The repository from .env is the destination offered in the next steps (checked in step 5)', async () => {
    await backupFlows.gotoJobs();
  });

  await test.step('3. Start Create > Backup for Database: the wizard opens on the Source step', async () => {
    await backupFlows.openWizard();
    expect(await wiz.onSourceStep()).toBe(true);
  });

  await test.step('4. Expand the instance and select the target database: it is selected as the backup source', async () => {
    await backupFlows.selectSources([{ item, databases: [db] }]);
    expect(await wiz.sourceSummaryText()).not.toContain('Select at least one item on the left');
  });

  await test.step('5. Proceed to Destination and open the repository list: the available repositories are listed', async () => {
    await backupFlows.next();
    await expect(backupWizardPage.destinationCombo).toBeVisible();
    await backupWizardPage.destinationCombo.click({ timeout: 10_000 });
    await expect(backupWizardPage.destinationOption(repo)).toBeVisible();
  });

  await test.step('6. Select the stream repository: it is shown as the destination and Next moves to Schedule', async () => {
    await backupWizardPage.destinationOption(repo).click({ timeout: 10_000 });
    await expect(backupWizardPage.destinationCombo).toHaveValue(new RegExp(repo));
    await backupFlows.next();
    expect(await wiz.onScheduleStep()).toBe(true);
  });

  await test.step('Ad hoc: going back to Destination still shows the chosen repository', async () => {
    await backupFlows.goToStep('Destination');
    const shown = await backupFlows.fieldValue(backupWizardPage.destinationCombo);
    expect(shown).toContain(repo);
  });
});
