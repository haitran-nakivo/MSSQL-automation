import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';

// NJM-154642: "[DBM-Inv-UI-Details-0009] Verify General Info - Type".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 is in Inventory and discovered.
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 2): the Inventory page is Settings > Inventory.
// case-vs-ui (step 4): the case expects "Microsoft SQL Server"; NBR shows the item type, here "Microsoft SQL Server instance".
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page General information shows the SQL Server instance type',
  { tag: '@NJM-154642' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage }, testInfo) => {
    test.setTimeout(300_000);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the SQL item is discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page and the details of the SQL item: General information is shown', async () => {
      await flows.openItem(name);
      await expect(inventoryItemPage.text('General information')).toBeVisible();
    });

    await test.step('3. The General information section has a Type field with a value', async () => {
      await expect(inventoryItemPage.detail('Type:')).toHaveText(/\S/);
    });

    await test.step('4. The Type field shows the application type', async () => {
      await expect.poll(() => flows.readItemDetails(), { message: 'the Type field does not show the instance type' }).toMatchObject({ type: ITEM_TYPES.instance });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154642 step 4: the case expects "Microsoft SQL Server"; NBR shows the item type "Microsoft SQL Server instance".' });
    });
  },
);
