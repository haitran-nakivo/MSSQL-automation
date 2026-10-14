import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { appendValue, replaceValue } from '../../../../../flows/pkg-obsa.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159680: "[MSSQL-Inv-UI-Options-0011] Verify Instance Name Text Compliance".
// Lab preconditions: signed-in Director; the standalone instance target of .env (mssqlInstanceTarget) supplies the compliant instance name, which is only typed.
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database" is "Settings > Inventory", the "+" button and the "Application" tile; "Microsoft SQL Server" is the Application type.
// case-vs-ui: the case expects "<invalid-instance-name!@#>" to be flagged as non-compliant or not accepted. The UI ACCEPTS <>!@# in the Instance name (aria-invalid stays
//   false); the test types "invalid-instance-name!@#" and asserts it is accepted.
// case-vs-ui: the case description says max 511 characters; the UI limit is 255 (255 valid, 256 invalid). Asserted in the extra step 5.
test.use(RUN_OPTIONS);

const INSTANCE_NAME_MAX_LENGTH = 255;
const DISALLOWED_PER_CASE = 'invalid-instance-name!@#';

test(
  'NAKIVO Add wizard accepts special characters in the Instance name, accepts a compliant name after clearing, and flags 256 characters',
  { tag: '@NJM-159680' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(240_000);
    const field = addInventoryItemPage.input('instanceName');

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

    await test.step('3. With Type = Microsoft SQL Server instance, enter an instance name containing disallowed characters', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects the field to flag or refuse the disallowed characters; the UI accepts <>!@# in the Instance name (aria-invalid stays false). The case data is undefined; "invalid-instance-name!@#" is used.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await replaceValue(field, DISALLOWED_PER_CASE);
      await expect(field).toHaveValue(DISALLOWED_PER_CASE);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('4. Clear the field and enter a compliant instance name; it is accepted with no validation error', async () => {
      await replaceValue(field, target.instanceName);
      await expect(field).toHaveValue(target.instanceName);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('5. (From the case description: length limit) Type 255 characters, then one more; 255 are valid and 256 are flagged', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case description says max 511 characters; the UI limit is 255 (255 valid, 256 invalid). This step is not a separate Xray step.' });
      await replaceValue(field, 'a'.repeat(INSTANCE_NAME_MAX_LENGTH));
      await expect(field).toHaveAttribute('aria-invalid', 'false');
      await appendValue(field, 'b');
      await expect(field).toHaveValue(`${'a'.repeat(INSTANCE_NAME_MAX_LENGTH)}b`);
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    });
  },
);
