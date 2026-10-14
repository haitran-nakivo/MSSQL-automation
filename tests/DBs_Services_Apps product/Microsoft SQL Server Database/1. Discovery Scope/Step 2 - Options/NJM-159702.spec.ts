import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159702: "[MSSQL-Inv-UI-Options-0023-6-4] Verify SQL Password Default State - Microsoft SQL Server Read-Scale availability group".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (no SQL host is contacted).
// Inventory side effects: none (nothing is typed; the wizard is left by returning to the Inventory list).
// case-vs-ui (steps 2-3): Xray "Add" > Microsoft SQL Server is the "+" button and the "Application" tile; the UI has no "Step 1 connection details":
//   Step 1 is the Platform and every field is on the "Options" step, so no host is entered and the Type is set there.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the SQL password field empty by default for a Read-Scale availability group',
  { tag: '@NJM-159702' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, addInventoryItemPage, wizardFlows }, testInfo) => {
    await test.step('1. Open Settings > Inventory; the Inventory list is displayed with the Add button', async () => {
      await flows.gotoInventory();
    });

    await test.step('2. Click Add, choose Application (Microsoft SQL Server) and proceed; the Add wizard opens', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" as the platform; the UI offers the "Application" tile. startAdd also sets the Read-Scale availability group Type.' });
      await flows.startAdd(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Proceed to Step 2 - Options; the Options page of the Read-Scale availability group is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI has no Step 1 connection details (Step 1 is the Platform); no host is entered, the Options page is reached directly.' });
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
    });

    await test.step('4. The SQL password field is displayed', async () => {
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('5. The SQL password field is empty in its default state', async () => {
      await expect
        .poll(() => wizardFlows.fieldState('password', 1), { message: 'the SQL password field is not empty by default' })
        .toMatchObject({ present: true, value: '' });
    });
  },
);
