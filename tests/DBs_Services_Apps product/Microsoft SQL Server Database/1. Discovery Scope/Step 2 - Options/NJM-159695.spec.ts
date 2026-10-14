import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159695: "[MSSQL-Inv-UI-Options-0023-3] Verify SQL Password Visibility - Microsoft SQL Server Always On availability group".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (no SQL host is contacted).
// Inventory side effects: none (nothing is typed; the wizard is left by returning to the Inventory list).
// case-vs-ui (step 1): the UI cannot show the license content or that the SQL host is reachable; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (step 2): Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is Settings > Inventory > "+" > "Application" tile > Next.
// case-vs-ui (step 3): the Always On availability group is the default Type of the wizard, so no Type is chosen; the AG name field shows that type's form.
// case-vs-ui (step 4): the label in the UI is "SQL password"; "masked" is checked as input type="password".
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows a masked SQL password field for an Always On availability group',
  { tag: '@NJM-159695' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, addInventoryItemPage, wizardFlows }, testInfo) => {
    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI cannot show the license content or that the SQL host is reachable; only the signed-in Director and the Inventory page are checked.' });
      await flows.gotoInventory();
    });

    await test.step('2. Open the Add wizard, choose Application (Microsoft SQL Server) and go to the Options step', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray "Add New > Application/Database > Microsoft SQL Server" is the "+" button and the "Application" tile; the default Type (Always On) is kept.' });
      await flows.startAdd();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Type = Microsoft SQL Server Always On availability group (the default); the Options page shows the fields of that type', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Always On availability group is the default Type, so nothing is selected; the AG name field shows the form of that type.' });
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
    });

    await test.step('4. The credentials area shows the SQL password field as a masked input', async () => {
      await expect.poll(() => wizardFlows.fieldCount('password'), { message: 'the form does not show the OS password and the SQL password fields' }).toBe(2);
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toHaveAttribute('type', 'password');
    });
  },
);
