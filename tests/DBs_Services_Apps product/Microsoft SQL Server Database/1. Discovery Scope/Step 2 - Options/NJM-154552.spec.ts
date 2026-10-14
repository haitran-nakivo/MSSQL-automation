import { test, expect } from '../../../../../fixtures';
import { replaceValue } from '../../../../../flows/pkg-obsa.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154552: "[DBM-Inv-UI-Add-Options-0009] Verify Display Name Non-Unicode Highlight".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case data "<string with disallowed characters>" is undefined and the expected result is a red highlight / validation message. The UI has no such rule for
//   the Display name: "<>", Unicode text, inner spaces and a tab are accepted and the field is not flagged (aria-invalid stays false). The test types "a<b>" and asserts it is accepted.
// notVerified: any character that the Display name rejects (none was found; only the 25-character maximum flags the field, see NJM-154548).
test.use(RUN_OPTIONS);

const VALUE_WITH_SPECIAL_CHARACTERS = 'a<b>';

test(
  'NAKIVO Add wizard accepts a Display name with angle brackets and does not flag it as invalid',
  { tag: '@NJM-154552' },
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

    await test.step('3. Enter a Display name with special characters; the field is accepted, not highlighted as invalid', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects the field to be highlighted as invalid for disallowed characters; the UI accepts "<>" and Unicode in the Display name (aria-invalid stays false). The case data is undefined; "a<b>" is used.' });
      const field = addInventoryItemPage.input('name');
      await replaceValue(field, VALUE_WITH_SPECIAL_CHARACTERS);
      await expect(field).toHaveValue(VALUE_WITH_SPECIAL_CHARACTERS);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
    });
  },
);
