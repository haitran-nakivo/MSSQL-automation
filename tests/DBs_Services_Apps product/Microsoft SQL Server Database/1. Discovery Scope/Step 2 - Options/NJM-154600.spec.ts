import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { replaceValue } from '../../../../../flows/pkg-obsa.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154600: "[MSSQL-Inv-UI-Options-0022-7-3] Verify SQL Username Space Validation".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: no Xray step selects the type; Microsoft SQL Server instance is chosen in step 3.
// case-vs-ui: the case accepts "trimmed or flagged as invalid"; the UI flags a username with a space anywhere (leading, trailing, inner) as invalid (aria-invalid="true"), it does not trim.
test.use(RUN_OPTIONS);

const USERNAME_WITH_SPACES = ' sql user ';

test(
  'NAKIVO Add wizard flags a SQL username with leading, trailing and embedded spaces as invalid',
  { tag: '@NJM-154600' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
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

    await test.step('3. Type a username with leading, trailing and embedded spaces into the SQL username and move focus away; the field is flagged invalid', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case allows "trimmed or flagged as invalid"; the UI flags the value as invalid (aria-invalid="true") and does not trim it.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      const field = addInventoryItemPage.input('username', 1);
      await replaceValue(field, USERNAME_WITH_SPACES);
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    });
  },
);
