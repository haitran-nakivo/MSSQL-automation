import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154554: "[DBM-Inv-UI-Add-Options-0011] Verify Type Dropdown Required".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (Finish is blocked by the empty form; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the UI has no red asterisk. The Type field is read-only and always holds a value (the first entry, the Always On type), so it can never
//   be empty; the test asserts that the value is set, that clearing is not possible and that Finish does not flag the Type.
// case-vs-ui: the case expects a Type validation error on Finish; no such error can occur. Finish is blocked only by the other empty required fields.
test.use(RUN_OPTIONS);

const DEFAULT_TYPE = 'Microsoft SQL Server Always On availability group';

test(
  'NAKIVO Add wizard always has a Type selected that cannot be cleared',
  { tag: '@NJM-154554' },
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

    await test.step('3. Inspect the Type dropdown; it is read-only and already holds a value (no red asterisk exists in the UI)', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects a required marker (red asterisk). The UI has none; the Type is a read-only combo preset to its first entry, so it always has a value.' });
      await expect(addInventoryItemPage.typeField).toHaveValue(DEFAULT_TYPE);
      expect((await wizardFlows.fieldState('type')).readOnly, 'the Type field is not read-only').toBe(true);
    });

    await test.step('4. Try to clear the Type and click Finish; the Type keeps its value and is not flagged, and the wizard does not proceed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Type cannot be cleared (read-only, no empty entry), so the case data "Type = <none>" cannot be set and no Type validation error occurs; Finish is blocked by the other empty required fields.' });
      await addInventoryItemPage.typeField.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Delete');
      await page.keyboard.press('Backspace');
      await expect(addInventoryItemPage.typeField).toHaveValue(DEFAULT_TYPE);
      await page.getByRole('button', { name: 'Finish' }).click();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'true');
      await expect(addInventoryItemPage.typeField).toHaveValue(DEFAULT_TYPE);
      await expect(addInventoryItemPage.typeField).not.toHaveAttribute('aria-invalid', 'true');
    });
  },
);
