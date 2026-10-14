import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154564: "[DBM-Inv-UI-Add-Options-0021] Verify OS Password Behavior".
// Lab preconditions: signed-in Director; the standalone instance target of .env (mssqlInstanceTarget) supplies the OS password, which is only typed.
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: "masks the characters" is asserted as the input type "password" (the browser shows dots); the password itself is never printed.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard masks a typed OS password',
  { tag: '@NJM-154564' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
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

    await test.step('3. Type a value into the OS password; the characters are masked', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The mask is asserted as the input type "password" and the field holding the typed value; the password is compared as a boolean so it never appears in a message.' });
      await wizardFlows.enter('password', target.osPassword, 0);
      const field = addInventoryItemPage.input('password', 0);
      await expect(field).toHaveAttribute('type', 'password');
      expect((await wizardFlows.fieldState('password', 0)).value === target.osPassword, 'the OS password field does not hold the typed value').toBe(true);
    });
  },
);
