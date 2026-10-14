import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154538: "[DBM-Inv-UI-Add-Platform-0001] Verify Application Option Display".
// Lab preconditions: signed-in Director whose license includes Microsoft SQL Server (the Application tile is enabled).
// Inventory side effects: none (the wizard is only opened; nothing is added).
// case-vs-ui: Xray "Application/Database" category and "Microsoft SQL Server" option are the single "Application" tile of the Platform step.
// case-vs-ui: Xray step 1 (license precondition) cannot be read in the UI; the wizard starting with the Application tile available is the evidence.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the Application platform option on the Platform step',
  { tag: '@NJM-154538' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    const application = page.getByText('Application', { exact: true }).filter({ visible: true });

    await test.step('1. Precondition: Director is accessible and licensed for Microsoft SQL Server; the Add wizard can be started', async () => {
      await flows.gotoInventory();
      await expect(page).toHaveURL(/\/c\/configuration/);
    });

    await test.step('2. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens on the Platform step', async () => {
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(application).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154538 step 2: the path is Settings > Inventory and the button is "+" (Add Inventory Item).' });
    });

    await test.step('3. Select the Application category; the application platform option is displayed', async () => {
      await addInventoryItemPage.chooseApplication();
      await expect(addInventoryItemPage.platformRadio('Application')).toBeChecked();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154538 step 3: there is no "Application/Database" category; Application is one of seven platform tiles.' });
    });

    await test.step('4. The Application option (Microsoft SQL Server) is displayed among the available platforms', async () => {
      await expect(application).toBeVisible();
      await expect(addInventoryItemPage.platformRadio('Application')).toBeEnabled();
      await expect(page.getByText(/Microsoft SQL Server/).filter({ visible: true }).first()).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154538 step 4: Microsoft SQL Server is named in the subtext of the Application tile, not shown as an option of its own.' });
    });
  },
);
