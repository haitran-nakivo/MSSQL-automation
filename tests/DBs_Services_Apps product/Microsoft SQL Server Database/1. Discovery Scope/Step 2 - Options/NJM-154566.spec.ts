import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154566: "[DBM-Inv-UI-Add-Options-0023] Verify Link Opens Dialog".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (the dialog is only opened, nothing is created or changed in it; leaving the page closes it).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the dialog is titled "Credentials Management" (Xray: "Manage Credentials dialog"); the first of the two Manage credentials links (OS pair) is clicked.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard opens the Credentials Management dialog from the Manage credentials link',
  { tag: '@NJM-154566' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
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

    await test.step('3. Click the Manage credentials link; the Credentials Management dialog opens', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The dialog is titled "Credentials Management" in the current UI (Xray: "Manage Credentials dialog"). The first of the two links (OS credential pair) is clicked.' });
      await page.getByText('Manage credentials', { exact: true }).filter({ visible: true }).first().click();
      await expect(page.getByText('Credentials Management', { exact: true }).filter({ visible: true })).toBeVisible();
      await wizardFlows.leave();
    });
  },
);
