import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154553: "[DBM-Inv-UI-Add-Options-0010] Verify Type Dropdown Existence".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the Type control is a read-only combo (a field that opens a list when clicked), labelled "Type".
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the Type dropdown with its label on the Options step',
  { tag: '@NJM-154553' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    await test.step('1. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens at the Platform step', async () => {
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile.' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.input('host')).toBeVisible();
    });

    await test.step('3. Locate the Type dropdown; the control is present with its label', async () => {
      await expect(addInventoryItemPage.typeField).toBeVisible();
      await expect(page.getByText(/^Type:?$/).filter({ visible: true }).first()).toBeVisible();
    });
  },
);
