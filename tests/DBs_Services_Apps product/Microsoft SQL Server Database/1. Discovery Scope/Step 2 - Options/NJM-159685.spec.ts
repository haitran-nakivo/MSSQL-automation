import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159685: "[MSSQL-Inv-UI-Options-0022-2] Verify SQL Username Visibility - Microsoft SQL Server failover cluster instance".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (the wizard is left by the test ending).
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is "Settings > Inventory", the "+" button and the "Application" tile.
// case-vs-ui: the field is labelled "SQL username"; the form has two username fields (OS first, SQL second), so the SQL one is the second.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the SQL username field for a Microsoft SQL Server failover cluster instance',
  { tag: '@NJM-159685' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
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

    await test.step('3. Set Type = Microsoft SQL Server failover cluster instance; the page shows the fields of that type', async () => {
      await addInventoryItemPage.chooseType(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
    });

    await test.step('4. Inspect the credentials area; the SQL username field is visible', async () => {
      await expect.poll(() => wizardFlows.fieldCount('username'), { message: 'the form does not show the OS and SQL username fields' }).toBe(2);
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
    });
  },
);
