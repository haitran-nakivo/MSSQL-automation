import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154576: "[DBM-Inv-UI-Add-Options-0033] Verify Cancel Confirmation Popup".
// Lab preconditions: signed-in Director; the standalone instance target host from .env (only typed into the Hostname field).
// Inventory side effects: none (the popup is not confirmed; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the popup is "Close the wizard?" with "All changes will be lost." and a Close button (observed text), shown when the form has data.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard asks for confirmation when Cancel is clicked after data was entered',
  { tag: '@NJM-154576' },
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

    await test.step('3. Enter a Hostname and click Cancel; a confirmation popup about discarding the entered data appears', async () => {
      await wizardFlows.enter('host', target.host);
      await expect(addInventoryItemPage.input('host')).toHaveValue(target.host);
      await page.getByText('Cancel', { exact: true }).filter({ visible: true }).click();
      await expect(page.getByText('Close the wizard?').filter({ visible: true })).toBeVisible();
      await expect(page.getByText('All changes will be lost.').filter({ visible: true })).toBeVisible();
    });
  },
);
