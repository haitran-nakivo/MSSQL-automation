import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154563: "[DBM-Inv-UI-Add-Options-0020] Verify OS Username Behavior".
// Lab preconditions: signed-in Director; the standalone instance target of .env (mssqlInstanceTarget) supplies the OS username, which is only typed.
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case checks only that the typed OS username is shown in clear text; the Credentials Management behavior (selecting a stored username)
//   named in the case title is not exercised.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows a typed OS username in clear text',
  { tag: '@NJM-154563' },
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

    await test.step('3. Type a value into the OS username; the field accepts and displays the text unmasked', async () => {
      await wizardFlows.enter('username', target.osUsername, 0);
      const field = addInventoryItemPage.input('username', 0);
      await expect(field).toHaveValue(target.osUsername);
      await expect(field).not.toHaveAttribute('type', 'password');
    });
  },
);
