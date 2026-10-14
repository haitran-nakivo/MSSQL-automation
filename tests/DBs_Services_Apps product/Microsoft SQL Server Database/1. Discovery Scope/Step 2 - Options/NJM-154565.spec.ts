import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154565: "[DBM-Inv-UI-Add-Options-0022] Verify Manage Credentials Link".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the link text is "Manage credentials"; the UI shows two of them, one under the OS credential pair and one under the SQL credential pair.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows a Manage credentials link under the OS and the SQL credentials',
  { tag: '@NJM-154565' },
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

    await test.step('3. Locate the Manage credentials link; it is present once per credential pair', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects one Manage Credentials link; the UI shows two "Manage credentials" links (OS pair and SQL pair).' });
      await expect(page.getByText('Manage credentials', { exact: true }).filter({ visible: true })).toHaveCount(2);
    });
  },
);
