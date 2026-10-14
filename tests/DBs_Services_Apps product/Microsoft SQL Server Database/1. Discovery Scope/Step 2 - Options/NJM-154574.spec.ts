import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154574: "[DBM-Inv-UI-Add-Options-0031] Verify Cancel Button Existence".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (the wizard is only opened, nothing is typed or added).
// case-vs-ui: Xray "Add New" is the "+" (Add Inventory Item) button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows a Cancel button on the Options step of Microsoft SQL Server',
  { tag: '@NJM-154574' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    await test.step('1. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens at the Platform step', async () => {
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile (subtext "Oracle database, Microsoft SQL Server.").' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
      await expect(addInventoryItemPage.input('host')).toBeVisible();
    });

    await test.step('3. Inspect the wizard footer; a Cancel button is present', async () => {
      await expect(page.getByText('Cancel', { exact: true }).filter({ visible: true })).toBeVisible();
    });
  },
);
