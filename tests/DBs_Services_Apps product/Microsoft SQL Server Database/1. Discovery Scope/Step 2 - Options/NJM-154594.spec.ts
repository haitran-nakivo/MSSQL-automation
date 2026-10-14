import { test, expect } from '../../../../../fixtures';
import { replaceValue } from '../../../../../flows/pkg-obsa.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154594: "[MSSQL-Inv-UI-Options-0020] Verify AG Name Text Compliance".
// Lab preconditions: signed-in Director; the AG target of .env (mssqlAgTarget) supplies the valid AG name, which is only typed (the host is not contacted).
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the case leaves the AG type open; the Always On availability group type (the wizard default) is used.
// case-vs-ui: the case data "<invalid-chars>" is undefined and expects non-compliant characters to be rejected or flagged. The UI ACCEPTS "bad<ag>!@#" in the AG name
//   (aria-invalid stays false); the test asserts it is accepted.
// notVerified: the length limit of the AG name (the case description says 511; the UI limit was not probed) and Unicode support.
test.use(RUN_OPTIONS);

const AVAILABILITY_GROUP_TYPE = 'Microsoft SQL Server Always On availability group';
const SPECIAL_VALUE = 'bad<ag>!@#';

test(
  'NAKIVO Add wizard accepts the typed AG name and accepts special characters in it',
  { tag: '@NJM-154594' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlAgTarget: target }, testInfo) => {
    const field = addInventoryItemPage.input('availabilityGroupName');

    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile. Xray step 2 "Add New" is merged into step 1 (the wizard is already open).' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Select an Availability Group type and type a valid AG name; the value is accepted and displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case leaves the AG type open; the Always On availability group type (the wizard default) is used.' });
      await expect(addInventoryItemPage.typeField).toHaveValue(AVAILABILITY_GROUP_TYPE);
      await replaceValue(field, target.agName);
      await expect(field).toHaveValue(target.agName);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('4. Enter a value with characters outside the usual character set and move focus away; the UI accepts it', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects non-compliant characters to be rejected or flagged; the UI accepts <>!@# in the AG name (aria-invalid stays false). The case data is undefined; "bad<ag>!@#" is used.' });
      await replaceValue(field, SPECIAL_VALUE);
      await expect(field).toHaveValue(SPECIAL_VALUE);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
    });
  },
);
