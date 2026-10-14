import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154571: "[DBM-Inv-UI-Add-Options-0028] Verify Finish Highlights Errors (Invalid)".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (Finish is blocked by the empty form; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case data says "Type = <none>"; the Type field is read-only and always has a value (default: Microsoft SQL Server Always On availability group), so only the empty required fields are left uncorrected.
// case-vs-ui: "highlighted" is the red border with aria-invalid="true" on Hostname or IP, OS username, the AG name and SQL username (the Display name and the passwords are not required and not flagged); the Director shows no inline message.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard highlights the empty required fields when Finish is clicked',
  { tag: '@NJM-154571' },
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

    await test.step('3. Leave the required fields empty; they are not yet corrected', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case data "Type = <none>" cannot be set: the Type field is read-only and preset. Only the empty Hostname or IP (and the other empty required fields) are left uncorrected.' });
      await expect(addInventoryItemPage.input('host')).toHaveValue('');
      await expect(addInventoryItemPage.input('username', 0)).toHaveValue('');
      await expect(addInventoryItemPage.input('availabilityGroupName')).toHaveValue('');
      await expect(addInventoryItemPage.input('username', 1)).toHaveValue('');
    });

    await test.step('4. Click Finish; the empty required fields are highlighted as invalid', async () => {
      await page.getByRole('button', { name: 'Finish' }).click();
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'true');
      await expect(addInventoryItemPage.input('username', 0)).toHaveAttribute('aria-invalid', 'true');
      await expect(addInventoryItemPage.input('availabilityGroupName')).toHaveAttribute('aria-invalid', 'true');
      await expect(addInventoryItemPage.input('username', 1)).toHaveAttribute('aria-invalid', 'true');
    });
  },
);
