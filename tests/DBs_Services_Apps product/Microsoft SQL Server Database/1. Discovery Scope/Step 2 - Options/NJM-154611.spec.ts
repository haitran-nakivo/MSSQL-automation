import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154611: "[MSSQL-Inv-UI-Options-0024] Verify Field Highlight on Error".
// Lab preconditions: signed-in Director; the standalone instance target values from .env (typed into the other fields; no host is contacted because Finish is blocked).
// Inventory side effects: none (Finish is blocked by the empty Instance name, so no item is created; the Inventory item count is compared before and after).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the case gives "Instance Name or SQL Username" as examples; Microsoft SQL Server instance with an empty Instance name is used.
// case-vs-ui: the wizard has no Next/Apply on the Options step; the attempt to proceed is the Finish button. The error state is aria-invalid="true" (red border in the UI, a screenshot is attached); the colour itself is not asserted.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard blocks Finish and highlights the empty required Instance name as invalid',
  { tag: '@NJM-154611' },
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

    await test.step('3. Leave a required field (Instance name) empty and click Finish; progression is blocked and a validation error is raised', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case names Instance Name or SQL Username as examples; Microsoft SQL Server instance with an empty Instance name is used. The Options step has Finish, not Next/Apply; the validation error is the invalid state of the field (aria-invalid), shown as hover text, not inline.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('username', target.sqlUsername, 1);
      await wizardFlows.enter('password', target.sqlPassword, 1);
      await expect(addInventoryItemPage.input('instanceName')).toHaveValue('');
      await wizardFlows.finish();
      await expect(addInventoryItemPage.input('instanceName')).toHaveAttribute('aria-invalid', 'true');
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('4. Observe the field that failed validation; it is highlighted as invalid and the filled fields are not', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The highlight is asserted through aria-invalid="true" on the field (the state the UI paints as a red border); the border colour is not read, a screenshot is attached as evidence.' });
      await expect(addInventoryItemPage.input('instanceName')).toHaveAttribute('aria-invalid', 'true');
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('username', 0)).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('username', 1)).toHaveAttribute('aria-invalid', 'false');
      await testInfo.attach('invalid-instance-name-highlight', { body: await page.screenshot(), contentType: 'image/png' });
      // Nothing was added: the rows are not visible while the wizard is open, so the list is reloaded before it is counted.
      await flows.gotoInventory();
      expect(await inventoryPage.itemCount(), 'the Inventory item count changed after the blocked Finish').toBe(itemCountBefore);
    });
  },
);
