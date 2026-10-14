import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154540: "[DBM-Inv-UI-Add-Platform-0003] Verify Option Disabled by License".
// Lab preconditions: signed-in Director on its CURRENT license (it includes Microsoft SQL Server; the lab has no restricted license and the
//   license expires soon, after which the state asserted here may change).
// Inventory side effects: none (the wizard is opened and the Application tile is selected; nothing is added).
// case-vs-ui: the owner decided to assert what NBR shows now at this place: the license includes Microsoft SQL Server, so the Application option
//   is enabled and selectable (the case expects it disabled under a license WITHOUT the feature).
// case-vs-ui: Xray "Application/Database" category and "Microsoft SQL Server" option are the single "Application" tile of the Platform step.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard offers the Application platform option as enabled when the current license includes Microsoft SQL Server',
  { tag: '@NJM-154540' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    const application = addInventoryItemPage.platformRadio('Application');

    await test.step('1. Precondition: the Director runs under its current license', async () => {
      await flows.gotoInventory();
      await expect(page).toHaveURL(/\/c\/configuration/);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154540 step 1: the case needs a license WITHOUT the Microsoft SQL Server feature; the lab Director has the current license, which includes it, so the test checks the current license state.' });
    });

    await test.step('2. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens on the Platform step', async () => {
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. The Application option (Microsoft SQL Server) is visible in the platform list', async () => {
      await expect(page.getByText('Application', { exact: true }).filter({ visible: true })).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154540 step 3: the Platform step has no "Application/Database" category or "Microsoft SQL Server" option; the "Application" tile is the option.' });
    });

    await test.step('4. Select the Application option; under the current license it is enabled and gets selected', async () => {
      await expect(application).toBeEnabled();
      await addInventoryItemPage.chooseApplication();
      await expect(application).toBeChecked();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154540 step 4: the case expects the option disabled by the license and not selectable; with the current license (MSSQL included) it is enabled and selectable.' });
    });
  },
);
