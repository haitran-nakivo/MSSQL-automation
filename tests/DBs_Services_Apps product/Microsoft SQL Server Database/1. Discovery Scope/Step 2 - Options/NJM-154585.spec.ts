import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154585: "[MSSQL-Inv-UI-Options-0005] Verify Instance Name Required".
// Lab preconditions: signed-in Director; the standalone instance target values from .env (typed into the other fields; no host is contacted because Finish is blocked).
// Inventory side effects: none (Finish is blocked by the empty Instance name, so no item is created; the Inventory item count is compared before and after).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the case leaves the type open ("a Type that shows the Instance Name field"); Microsoft SQL Server instance is used.
// case-vs-ui: the wizard has no Next/Apply on the Options step; the attempt to proceed is the Finish button. The required-field validation is the red border with aria-invalid="true" (no inline message).
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard blocks Finish and marks the Instance name as required when it is empty',
  { tag: '@NJM-154585' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
    let itemCountBefore = 0;

    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      await flows.gotoInventory();
      itemCountBefore = await inventoryPage.itemCount();
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

    await test.step('3. Select a Type that shows the Instance name field and leave it empty; the field is empty', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case leaves the type open; the type Microsoft SQL Server instance is used.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
      await expect(addInventoryItemPage.input('instanceName')).toHaveValue('');
    });

    await test.step('4. Fill the remaining fields and click Finish; the wizard is blocked and the Instance name is marked as required', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Options step has Finish, not Next/Apply. The remaining fields are Hostname or IP, the OS credentials and the SQL credentials.' });
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('username', target.sqlUsername, 1);
      await wizardFlows.enter('password', target.sqlPassword, 1);
      await page.getByRole('button', { name: 'Finish' }).click();
      await expect(addInventoryItemPage.input('instanceName')).toHaveAttribute('aria-invalid', 'true');
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('username', 0)).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('username', 1)).toHaveAttribute('aria-invalid', 'false');
      // Nothing was added: the rows are not visible while the wizard is open, so the list is reloaded before it is counted.
      await flows.gotoInventory();
      expect(await inventoryPage.itemCount(), 'the Inventory item count changed after the blocked Finish').toBe(itemCountBefore);
    });
  },
);
