import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159682: "[MSSQL-Inv-UI-Options-0017] Verify AG Name Default State".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (nothing is typed; the wizard is left by the test ending).
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is "Settings > Inventory", the "+" button and the "Application" tile.
// case-vs-ui: the field is labelled "AG name"; the case steps use the Always On availability group type (the wizard default), as written.
test.use(RUN_OPTIONS);

const AVAILABILITY_GROUP_TYPE = 'Microsoft SQL Server Always On availability group';

test(
  'NAKIVO Add wizard shows the AG name field empty, enabled and editable for an Always On availability group',
  { tag: '@NJM-159682' },
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

    await test.step('3. Set Type = Microsoft SQL Server Always On availability group and inspect the AG name field; it is empty, enabled and editable', async () => {
      await addInventoryItemPage.chooseType(AVAILABILITY_GROUP_TYPE);
      await expect(addInventoryItemPage.typeField).toHaveValue(AVAILABILITY_GROUP_TYPE);
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
      await expect
        .poll(() => wizardFlows.fieldState('availabilityGroupName'), { message: 'the AG name field is not in its default state (empty, enabled, editable)' })
        .toMatchObject({ present: true, value: '', readOnly: false, disabled: false });
    });
  },
);
