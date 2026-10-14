import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154601: "[MSSQL-Inv-UI-Options-0022-7-4] Verify SQL Username Case Insensitivity".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (the typed value is never submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: no Xray step selects the type; Microsoft SQL Server instance is chosen in step 3.
// case-vs-ui: the case says the username is treated case-insensitively (matching); the wizard shows no such matching, so only "the mixed-case value is accepted" (shown unchanged and not marked invalid) is asserted.
test.use(RUN_OPTIONS);

const MIXED_CASE_USER = 'SqlAdmin';

test(
  'NAKIVO Add wizard accepts a mixed-case SQL username without marking it invalid',
  { tag: '@NJM-154601' },
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

    await test.step('3. Type the SQL username SqlAdmin in mixed case; the value is accepted', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The wizard shows no case-insensitive matching of the username; only acceptance of the mixed-case value (kept unchanged, not marked invalid) is asserted. No Xray step selects the type; Microsoft SQL Server instance is chosen.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await wizardFlows.enter('username', MIXED_CASE_USER, 1);
      await expect(addInventoryItemPage.input('username', 1)).toHaveValue(MIXED_CASE_USER);
      await expect(addInventoryItemPage.input('username', 1)).toHaveAttribute('aria-invalid', 'false');
    });
  },
);
