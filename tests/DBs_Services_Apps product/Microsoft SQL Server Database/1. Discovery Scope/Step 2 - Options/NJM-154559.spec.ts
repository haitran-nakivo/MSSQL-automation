import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154559: "[DBM-Inv-UI-Add-Options-0016] Verify Hostname Field Existence".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the label is "Hostname or IP" (Xray: "Hostname").
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the Hostname or IP field with its label on the Options step',
  { tag: '@NJM-154559' },
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

    await test.step('3. Locate the Hostname or IP field; the input is present with its label', async () => {
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(page.getByText(/^Hostname or IP:?$/).filter({ visible: true }).first()).toBeVisible();
    });
  },
);
