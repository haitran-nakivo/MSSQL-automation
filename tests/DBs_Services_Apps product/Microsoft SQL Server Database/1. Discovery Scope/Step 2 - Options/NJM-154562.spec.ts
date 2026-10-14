import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154562: "[DBM-Inv-UI-Add-Options-0019] Verify OS Username Field Existence".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the label is "OS username"; the control is a combo (type a name or select a stored one), not a plain input.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the OS username field with its label on the Options step',
  { tag: '@NJM-154562' },
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

    await test.step('3. Locate the OS username field; the control is present with its label', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The OS username is a combo (type or select a username), not a plain input.' });
      await expect(addInventoryItemPage.input('username', 0)).toBeVisible();
      await expect(page.getByText(/^OS username:?$/).filter({ visible: true }).first()).toBeVisible();
    });
  },
);
