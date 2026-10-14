import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154557: "[DBM-Inv-UI-Add-Options-0014] Verify Type Dropdown Default Selection".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case does not name the default; the UI preselects the first entry of the list, "Microsoft SQL Server Always On availability group".
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard preselects the first Type, Microsoft SQL Server Always On availability group, when the Options step opens',
  { tag: '@NJM-154557' },
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
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Observe the Type dropdown before any selection; it shows the first entry of the list', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case does not name the default selection; the UI shows the first entry, "Microsoft SQL Server Always On availability group".' });
      await expect(addInventoryItemPage.typeField).toHaveValue('Microsoft SQL Server Always On availability group');
    });
  },
);
