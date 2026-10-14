import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154586: "[MSSQL-Inv-UI-Options-0007] Verify Instance Name Default State".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (nothing is typed; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the case leaves the type open ("a Type that shows the Instance Name field"); Microsoft SQL Server instance is used.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the Instance name field empty, enabled and editable by default',
  { tag: '@NJM-154586' },
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

    await test.step('3. Select a Type that shows the Instance name field and inspect it without typing; it is empty, enabled and editable', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case leaves the type open; the type Microsoft SQL Server instance is used.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
      await expect
        .poll(() => wizardFlows.fieldState('instanceName'), { message: 'the Instance name field is not in its default state (empty, enabled, editable)' })
        .toMatchObject({ present: true, value: '', readOnly: false, disabled: false });
    });
  },
);
