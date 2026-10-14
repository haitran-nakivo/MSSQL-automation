import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159694: "[MSSQL-Inv-UI-Options-0023-2] Verify SQL Password Visibility - Microsoft SQL Server failover cluster instance".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (no SQL host is contacted).
// Inventory side effects: none (nothing is typed; the wizard is left by returning to the Inventory list).
// case-vs-ui (step 1): the UI cannot show the license content or that the SQL host is reachable; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (step 2): Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is Settings > Inventory > "+" > "Application" tile > Next.
// case-vs-ui (step 4): the label in the UI is "SQL password"; "masked" is checked as input type="password".
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows a masked SQL password field for a failover cluster instance',
  { tag: '@NJM-159694' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, addInventoryItemPage, wizardFlows }, testInfo) => {
    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI cannot show the license content or that the SQL host is reachable; only the signed-in Director and the Inventory page are checked.' });
      await flows.gotoInventory();
    });

    await test.step('2. Open the Add wizard, choose Application (Microsoft SQL Server) and go to the Options step', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray "Add New > Application/Database > Microsoft SQL Server" is the "+" button and the "Application" tile; startAdd also sets the Type of step 3.' });
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Set Type = Microsoft SQL Server failover cluster instance; the Options page shows the fields of that type', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
    });

    await test.step('4. The credentials area shows the SQL password field as a masked input', async () => {
      await expect.poll(() => wizardFlows.fieldCount('password'), { message: 'the form does not show the OS password and the SQL password fields' }).toBe(2);
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toHaveAttribute('type', 'password');
    });
  },
);
