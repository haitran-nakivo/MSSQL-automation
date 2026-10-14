import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { appendValue, replaceValue } from '../../../../../flows/pkg-obsa.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154588: "[MSSQL-Inv-UI-Options-0010] Verify Instance Name Text Compliance".
// Lab preconditions: signed-in Director; the standalone instance target of .env (mssqlInstanceTarget) supplies the valid instance name, which is only typed.
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the case leaves the type open ("a Type that shows the Instance Name field"); Microsoft SQL Server instance is used.
// case-vs-ui: the case data "<invalid-chars>" is undefined and expects non-compliant characters to be rejected or flagged. The UI ACCEPTS the characters <>!@#, inner
//   spaces and leading/trailing spaces in the Instance name (aria-invalid stays false); the test types "bad<inst>!@#" and asserts it is accepted.
// case-vs-ui: the case title says max 511 characters; the UI limit is 255: 255 characters are valid, 256 are flagged (aria-invalid="true", the field keeps the 256th
//   character). Asserted in the extra step 5. The Unicode part of the case DESC is not exercised for this field (not observed).
test.use(RUN_OPTIONS);

const INSTANCE_NAME_MAX_LENGTH = 255;
const SPECIAL_VALUE = 'bad<inst>!@#';

test(
  'NAKIVO Add wizard accepts the typed Instance name, accepts special characters in it, and flags a 256-character value',
  { tag: '@NJM-154588' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(240_000);
    const field = addInventoryItemPage.input('instanceName');

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

    await test.step('3. Select a Type that shows the Instance name field and type a valid instance name; the value is accepted and displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case leaves the type open; the type Microsoft SQL Server instance is used.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await replaceValue(field, target.instanceName);
      await expect(field).toHaveValue(target.instanceName);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('4. Enter a value with characters outside the usual character set and move focus away; the UI accepts it', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects non-compliant characters to be rejected or flagged; the UI accepts <>!@# in the Instance name (aria-invalid stays false). The case data is undefined; "bad<inst>!@#" is used.' });
      await replaceValue(field, SPECIAL_VALUE);
      await expect(field).toHaveValue(SPECIAL_VALUE);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('5. (From the case description: length limit) Type 255 characters, then one more; 255 are valid and 256 are flagged', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case description says max 511 characters; the UI limit is 255 (255 valid, 256 invalid). This step is not a separate Xray step; it covers the limit named in the case description.' });
      await replaceValue(field, 'a'.repeat(INSTANCE_NAME_MAX_LENGTH));
      await expect(field).toHaveAttribute('aria-invalid', 'false');
      await appendValue(field, 'b');
      await expect(field).toHaveValue(`${'a'.repeat(INSTANCE_NAME_MAX_LENGTH)}b`);
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    });
  },
);
