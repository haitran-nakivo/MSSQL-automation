import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154579: "[MSSQL-Inv-UI-Options-0002-1] Verify Type Dropdown Content".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (the dropdown is only opened; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the type names are "Microsoft SQL Server Always On availability group / failover cluster instance / instance / Read-Scale availability group"
//   (Xray: Standalone instance, FCI, Always On AG, Read-Scale AG); the list also contains "Oracle database", which the case does not mention.
test.use(RUN_OPTIONS);

const AVAILABILITY_GROUP_TYPE = 'Microsoft SQL Server Always On availability group';

test(
  'NAKIVO Add wizard lists the four Microsoft SQL Server deployment types in the Type dropdown',
  { tag: '@NJM-154579' },
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

    await test.step('3. Open the Type dropdown; its list of selectable types is shown', async () => {
      await addInventoryItemPage.typeField.click();
      await expect(page.getByText(AVAILABILITY_GROUP_TYPE, { exact: true }).filter({ visible: true })).toBeVisible();
    });

    await test.step('4. Review the listed types; the four Microsoft SQL Server types are listed, each once', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The current names are "Microsoft SQL Server Always On availability group", "... failover cluster instance", "... instance" and "... Read-Scale availability group"; the list also holds "Oracle database" (not asserted).' });
      for (const typeName of [AVAILABILITY_GROUP_TYPE, ITEM_TYPES.failoverCluster, ITEM_TYPES.instance, ITEM_TYPES.readScale]) {
        await expect(page.getByText(typeName, { exact: true }).filter({ visible: true }), `"${typeName}" must be listed exactly once`).toHaveCount(1);
      }
    });
  },
);
