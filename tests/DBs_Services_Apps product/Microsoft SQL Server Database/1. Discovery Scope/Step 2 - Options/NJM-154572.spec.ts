import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154572: "[DBM-Inv-UI-Add-Options-0029] Verify Finish Stays in Wizard (Invalid)".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (Finish is blocked by the empty form, so no item is created; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the Options step is the last step of the current wizard (stepper "1. Platform, 2. Options"), so "does not advance" is checked as: the Options fields and the Finish button are still shown.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard stays open on the Options step when Finish is clicked with an empty Hostname',
  { tag: '@NJM-154572' },
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

    await test.step('3. Leave Hostname or IP (and the other required fields) empty; they are not yet corrected', async () => {
      await expect(addInventoryItemPage.input('host')).toHaveValue('');
    });

    await test.step('4. Click Finish; the wizard stays open on the Options step', async () => {
      await page.getByRole('button', { name: 'Finish' }).click();
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'true');
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.typeField).toBeVisible();
      await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
    });
  },
);
