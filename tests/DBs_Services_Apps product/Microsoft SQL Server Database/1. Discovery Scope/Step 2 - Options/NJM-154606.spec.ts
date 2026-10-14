import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154606: "[MSSQL-Inv-UI-Options-0023-6-7-2] Verify SQL Password Case Sensitivity".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (the typed value is never submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: no Xray step selects the type; Microsoft SQL Server instance is chosen in step 3.
// case-vs-ui: only that the field keeps the exact case typed is asserted (the case's own expected result); case-sensitive authentication is not exercised.
test.use(RUN_OPTIONS);

const MIXED_CASE_PASSWORD = 'PaSsWoRd123';

test(
  'NAKIVO Add wizard keeps the exact letter case typed into the SQL password',
  { tag: '@NJM-154606' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
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

    await test.step('3. Type PaSsWoRd123 into the SQL password; the exact case is preserved', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'No Xray step selects the type (Microsoft SQL Server instance is chosen); only retention of the exact case in the field is asserted, not case-sensitive authentication.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await wizardFlows.enter('password', MIXED_CASE_PASSWORD, 1);
      await expect(addInventoryItemPage.input('password', 1)).toHaveValue(MIXED_CASE_PASSWORD);
    });
  },
);
