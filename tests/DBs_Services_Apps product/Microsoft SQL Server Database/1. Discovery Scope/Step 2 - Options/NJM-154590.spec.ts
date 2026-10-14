import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154590: "[MSSQL-Inv-UI-Options-0013] Verify AG Name Visibility (Read-Scale)".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: Xray "Read-Scale Availability Group (clusterless AG)" is the type "Microsoft SQL Server Read-Scale availability group".
// case-vs-ui: the field is labelled "AG name" in the current UI (Xray: "AG Name (Availability Group name)").
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the AG name field when the Type is a Microsoft SQL Server Read-Scale availability group',
  { tag: '@NJM-154590' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile. Xray step 2 "Add New" is merged into step 1 (the wizard is already open).' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Set the Type to Microsoft SQL Server Read-Scale availability group; it is selected', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray "Read-Scale Availability Group (clusterless AG)" is the type "Microsoft SQL Server Read-Scale availability group" in the current UI.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
    });

    await test.step('4. Inspect the Options page; the AG name field is displayed', async () => {
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
    });
  },
);
