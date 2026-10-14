import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154607: "[MSSQL-Inv-UI-Options-0023-6-7-3] Verify SQL Password Masking (Privacy)".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (the typed value is never submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: no Xray step selects the type; Microsoft SQL Server instance is chosen in step 3. Masking is asserted as the input type "password" (the browser then shows dots); the typed text is a fixed dummy value, not a lab secret.
test.use(RUN_OPTIONS);

const DUMMY_PASSWORD = 'Mask-Check-123';

test(
  'NAKIVO Add wizard masks the characters typed into the SQL password',
  { tag: '@NJM-154607' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
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

    await test.step('3. Type a password into the SQL password; the characters are masked, not shown in clear text', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'No Xray step selects the type (Microsoft SQL Server instance is chosen). Masking is asserted as the input type "password"; a fixed dummy value is typed instead of <sql-password>.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await wizardFlows.enter('password', DUMMY_PASSWORD, 1);
      await expect(addInventoryItemPage.input('password', 1)).toHaveAttribute('type', 'password');
      await testInfo.attach('sql-password-masked', { body: await page.screenshot(), contentType: 'image/png' });
    });
  },
);
