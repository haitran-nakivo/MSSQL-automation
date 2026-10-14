import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { appendValue, replaceValue } from '../../../../../flows/pkg-obsa.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154599: "[MSSQL-Inv-UI-Options-0022-7-2] Verify SQL Username Length Limit".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the case data "<max-length-user>" is undefined; the maximum is 511 characters as stated in the case description and observed in the UI (511 valid, 512 invalid).
// case-vs-ui: the case expects input beyond the maximum to be rejected or truncated. The UI keeps the 512th character and flags the field (aria-invalid="true").
// case-vs-ui: no Xray step selects the type; Microsoft SQL Server instance is chosen in step 3.
test.use(RUN_OPTIONS);

const MAX_LENGTH = 511;

test(
  'NAKIVO Add wizard accepts a 511-character SQL username and flags the field when a 512th character is typed',
  { tag: '@NJM-154599' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    test.setTimeout(240_000);
    const field = addInventoryItemPage.input('username', 1);
    const maxUser = 'u'.repeat(MAX_LENGTH);

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

    await test.step('3. Type a username of the maximum allowed length (511) into the SQL username; all characters are accepted', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'No Xray step selects the type (Microsoft SQL Server instance is chosen); the case data is undefined, so 511 characters (the observed limit) are typed.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await replaceValue(field, maxUser);
      await expect(field).toHaveValue(maxUser);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('4. Type one more character; the SQL username is flagged as beyond the length limit', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects input beyond the limit to be rejected or truncated; the UI keeps the 512th character and flags the field (aria-invalid="true").' });
      await appendValue(field, 'x');
      await expect(field).toHaveValue(`${maxUser}x`);
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    });
  },
);
