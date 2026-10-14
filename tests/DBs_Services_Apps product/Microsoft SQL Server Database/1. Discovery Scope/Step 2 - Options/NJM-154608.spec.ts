import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { clickRightEdgeAndReadType } from '../../../../../flows/pkg-obsa.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154608: "[MSSQL-Inv-UI-Options-0023-6-7-4] Verify SQL Password field not have Eye Toggle".
// Lab preconditions: signed-in Director; the standalone instance target of .env (mssqlInstanceTarget) supplies the SQL password, which is only typed (never printed or submitted).
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the case title says the field has NO eye toggle, but its expected result says "the password is revealed in clear text". The UI has no eye toggle and
//   never reveals the password: the input stays type="password" and a click on the right edge of the field does not change it. The test follows the UI (title).
// case-vs-ui: no Xray step selects the type; Microsoft SQL Server instance is chosen in step 3.
// notVerified: the absence of an eye icon element is shown by behaviour only (type stays "password" after typing and after a click on the field's right edge).
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard keeps the typed SQL password masked and offers no eye toggle to reveal it',
  { tag: '@NJM-154608' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
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

    await test.step('3. Type a password into the SQL password; it stays masked and no eye toggle reveals it', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects the password to be revealed in clear text; the UI has no eye toggle (as the case title says): the input stays type="password", also after a click on the right edge of the field.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await wizardFlows.enter('password', target.sqlPassword, 1);
      const field = addInventoryItemPage.input('password', 1);
      expect((await wizardFlows.fieldState('password', 1)).value === target.sqlPassword, 'the SQL password field does not hold the typed value').toBe(true);
      await expect(field).toHaveAttribute('type', 'password');
      expect(await clickRightEdgeAndReadType(field), 'a click on the right edge of the SQL password field changed its input type').toBe('password');
      await expect(field).toHaveAttribute('type', 'password');
    });
  },
);
