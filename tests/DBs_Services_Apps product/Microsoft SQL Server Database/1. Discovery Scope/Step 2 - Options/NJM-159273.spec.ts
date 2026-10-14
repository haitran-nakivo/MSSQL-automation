import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159273: "[MSSQL-Inv-UI-Options-0002-3] Verify Type Dropdown Content include Microsoft SQL Server Always On availability group.".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (the dropdown is only opened; nothing is created).
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is "Settings > Inventory", the "+" button and the "Application" tile.
// case-vs-ui: the current list holds five types (the four Microsoft SQL Server types and "Oracle database"); only the Always On availability group entry is asserted.
test.use(RUN_OPTIONS);

const AVAILABILITY_GROUP_TYPE = 'Microsoft SQL Server Always On availability group';

test(
  'NAKIVO Add wizard lists the Microsoft SQL Server Always On availability group type in the Type dropdown',
  { tag: '@NJM-159273' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The SQL host is not contacted by this case; only the signed-in Director and the Application tile are checked.' });
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile.' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Open the Type drop-down; it expands and lists the types', async () => {
      await addInventoryItemPage.typeField.click();
      await expect(page.getByText(AVAILABILITY_GROUP_TYPE, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    });

    await test.step('4. Inspect the entries; the list includes the Microsoft SQL Server Always On availability group option', async () => {
      await expect(page.getByText(AVAILABILITY_GROUP_TYPE, { exact: true }).filter({ visible: true }), 'the Always On availability group type must be listed exactly once').toHaveCount(1);
    });
  },
);
