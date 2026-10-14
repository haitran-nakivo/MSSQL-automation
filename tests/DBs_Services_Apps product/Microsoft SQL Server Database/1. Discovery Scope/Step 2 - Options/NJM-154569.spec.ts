import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154569: "[DBM-Inv-UI-Add-Options-0026] Verify Finish Button Enabled State".
// Lab preconditions: signed-in Director; the standalone instance target values from .env (used only to type into the form).
// Inventory side effects: none (Finish is never clicked; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case data lists Type, Hostname, OS Username and OS Password; the form also requires Instance name and SQL username, so those are filled too.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard keeps the Finish button enabled on the empty and on the filled Options step',
  { tag: '@NJM-154569' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
    const finish = page.getByRole('button', { name: 'Finish' });

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

    await test.step('3. Observe the Finish button on the freshly loaded Options page; it is enabled', async () => {
      await expect(finish).toBeVisible();
      await expect(finish).toBeEnabled();
    });

    await test.step('4. Choose the type and fill all required fields with valid values; Finish stays enabled', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case data omits Instance name and SQL username, which the form also requires; they are filled as well. Type = Microsoft SQL Server instance.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('instanceName', target.instanceName);
      await wizardFlows.enter('username', target.sqlUsername, 1);
      await wizardFlows.enter('password', target.sqlPassword, 1);
      await expect(finish).toBeEnabled();
    });
  },
);
