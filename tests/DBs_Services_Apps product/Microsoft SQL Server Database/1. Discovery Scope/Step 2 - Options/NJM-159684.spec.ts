import { test, expect } from '../../../../../fixtures';
import { replaceValue } from '../../../../../flows/pkg-obsa.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159684: "[MSSQL-Inv-UI-Options-0021] Verify AG Name Text Compliance".
// Lab preconditions: signed-in Director; the AG target of .env (mssqlAgTarget) supplies the compliant AG name, which is only typed (the host is not contacted).
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database" is "Settings > Inventory", the "+" button and the "Application" tile; "Microsoft SQL Server" is the Application type.
// case-vs-ui: the Always On availability group type is the wizard default, so step 3 checks the selection instead of changing it.
// case-vs-ui: the case expects "<invalid-ag-name!@#>" to be flagged as non-compliant or not accepted. The UI ACCEPTS <>!@# in the AG name (aria-invalid stays false);
//   the test types "invalid-ag-name!@#" and asserts it is accepted.
// notVerified: the length limit of the AG name (the case description says 511; the UI limit was not probed) and Unicode support.
test.use(RUN_OPTIONS);

const AVAILABILITY_GROUP_TYPE = 'Microsoft SQL Server Always On availability group';
const DISALLOWED_PER_CASE = 'invalid-ag-name!@#';

test(
  'NAKIVO Add wizard accepts special characters in the AG name and accepts a compliant AG name after clearing',
  { tag: '@NJM-159684' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlAgTarget: target }, testInfo) => {
    const field = addInventoryItemPage.input('availabilityGroupName');

    await test.step('1. Precondition: Director is running and the Microsoft SQL Server Application option is available in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray "Add New > Application/Database > Microsoft SQL Server" is the "+" button and the "Application" tile in the current UI.' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. With Type = Microsoft SQL Server Always On availability group, enter an AG name containing disallowed characters', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Always On type is the wizard default. The case expects the field to flag or refuse the disallowed characters; the UI accepts <>!@# in the AG name (aria-invalid stays false). The case data is undefined; "invalid-ag-name!@#" is used.' });
      await expect(addInventoryItemPage.typeField).toHaveValue(AVAILABILITY_GROUP_TYPE);
      await replaceValue(field, DISALLOWED_PER_CASE);
      await expect(field).toHaveValue(DISALLOWED_PER_CASE);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('4. Clear the field and enter a compliant AG name; it is accepted with no validation error', async () => {
      await replaceValue(field, target.agName);
      await expect(field).toHaveValue(target.agName);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
    });
  },
);
