import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154560: "[DBM-Inv-UI-Add-Options-0017] Verify Hostname Field Required".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (Finish is blocked by the empty form; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the UI has no red asterisk; a required field is shown by a red border with aria-invalid="true" once the field is left empty (or after Finish).
//   The Director shows no inline message (the message is hover text).
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard flags an empty Hostname or IP as required and does not proceed when Finish is clicked',
  { tag: '@NJM-154560' },
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

    await test.step('3. Inspect the Hostname or IP field for a required indicator; the empty field is marked invalid once it is left', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects a red asterisk; the UI marks a required field with a red border and aria-invalid="true" after the empty field is left.' });
      await expect(addInventoryItemPage.input('host')).toHaveValue('');
      await wizardFlows.touch('host');
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'true');
    });

    await test.step('4. Leave the Hostname or IP empty and click Finish; the wizard does not proceed and the field stays flagged', async () => {
      await page.getByRole('button', { name: 'Finish' }).click();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.input('host')).toHaveValue('');
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'true');
    });
  },
);
