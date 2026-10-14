import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154535: "[MSSQL-Inv-UI-Platform-0001-TC01] Verify Application Option Display & Subtext".
// Lab preconditions: signed-in Director whose license includes Microsoft SQL Server (the Application tile is enabled).
// Inventory side effects: none (the wizard is only opened and the tile is selected; nothing is added).
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory, and "Add New" is the "+" (Add Inventory Item) button.
// case-vs-ui: Xray "Application/Database" category and "Microsoft SQL Server" option are the single "Application" tile; its subtext is "Oracle database, Microsoft SQL Server.".
// case-vs-ui: Xray step 1 (license precondition) cannot be arranged by the test; it is shown by the wizard opening with the Application tile available.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the Application platform with the subtext naming Microsoft SQL Server',
  { tag: '@NJM-154535' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    const application = page.getByText('Application', { exact: true }).filter({ visible: true });

    await test.step('1. Precondition: Director is accessible and licensed for Microsoft SQL Server; the Add wizard can be started', async () => {
      await flows.gotoInventory();
      await expect(page).toHaveURL(/\/c\/configuration/);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154535 step 1: the license cannot be read in the UI; the wizard starting in step 2 with the Application tile available is the evidence.' });
    });

    await test.step('2. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens on the Platform step', async () => {
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(application).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154535 step 2: the path is Settings > Inventory and the button is "+" (Add Inventory Item).' });
    });

    await test.step('3. Select the Application category on the Platform step; the supported application platforms are described', async () => {
      await addInventoryItemPage.chooseApplication();
      await expect(addInventoryItemPage.platformRadio('Application')).toBeChecked();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154535 step 3: the Platform step has no "Application/Database" category; "Application" is one of seven platform choices.' });
    });

    await test.step('4. The Application option that covers Microsoft SQL Server is displayed and available for selection', async () => {
      await expect(application).toBeVisible();
      await expect(addInventoryItemPage.platformRadio('Application')).toBeEnabled();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154535 step 4: there is no separate "Microsoft SQL Server" option on the Platform step; the Application tile is the option.' });
    });

    await test.step('5. The subtext under the Application option names Microsoft SQL Server', async () => {
      await expect(page.getByText(/Oracle database, Microsoft SQL Server\./).filter({ visible: true })).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154535 step 5: the subtext is "Oracle database, Microsoft SQL Server." (it names Oracle database as well).' });
    });
  },
);
