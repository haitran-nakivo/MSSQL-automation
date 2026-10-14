import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159693: "[MSSQL-Inv-UI-Options-0022-6-4] Verify SQL Username Default State - Microsoft SQL Server Read-Scale availability group".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (no SQL host is contacted).
// Inventory side effects: none (the wizard is left by returning to the Inventory list; one character is typed into SQL username and never saved).
// case-vs-ui (step 1): the UI cannot show the license content or that the SQL host is reachable; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (step 2): Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is Settings > Inventory > "+" > "Application" tile > Next.
// case-vs-ui (step 3): the SQL username is a combo (type or select a stored credential); "editable" is checked by typing into it.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the SQL username field empty, enabled and editable by default for a Read-Scale availability group',
  { tag: '@NJM-159693' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, addInventoryItemPage, wizardFlows }, testInfo) => {
    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI cannot show the license content or that the SQL host is reachable; only the signed-in Director and the Inventory page are checked.' });
      await flows.gotoInventory();
    });

    await test.step('2. Open the Add wizard, choose Application (Microsoft SQL Server) and go to the Options step', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray "Add New > Application/Database > Microsoft SQL Server" is the "+" button and the "Application" tile; startAdd also sets the Type of step 3.' });
      await flows.startAdd(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Set Type = Microsoft SQL Server Read-Scale availability group; the SQL username field is empty, enabled and editable', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
      await expect
        .poll(() => wizardFlows.fieldState('username', 1), { message: 'the SQL username field is not in its default state (empty, enabled, editable)' })
        .toMatchObject({ present: true, value: '', readOnly: false, disabled: false });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The SQL username is a combo; editable is checked by typing one character into it.' });
      await wizardFlows.enter('username', 'x', 1);
      await expect.poll(async () => (await wizardFlows.fieldState('username', 1)).value, { message: 'the SQL username field did not accept typed text' }).toBe('x');
    });
  },
);
