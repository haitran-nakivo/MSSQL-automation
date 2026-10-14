import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154577: "[DBM-Inv-UI-Add-Options-0034] Verify Popup Close Action".
// Lab preconditions: signed-in Director; the standalone instance target host from .env (only typed into the Hostname field).
// Inventory side effects: none (the wizard is closed without adding anything; the Inventory item count is compared before and after).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: step 3 clicks Cancel without data; the popup was observed only when the form has changes, so a Hostname is typed first.
// case-vs-ui: the Xray step expects "confirm and dismiss options"; only the "Close" button is observed on the popup, so only it is asserted (the dismiss option is not checked).
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard closes without adding an item when Close is chosen in the Cancel confirmation popup',
  { tag: '@NJM-154577' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
    let itemCountBefore = 0;

    await test.step('1. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens at the Platform step', async () => {
      await flows.gotoInventory();
      itemCountBefore = await inventoryPage.itemCount();
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

    await test.step('3. Click Cancel; the confirmation popup "Close the wizard?" is displayed with a Close option', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Xray step clicks Cancel with no data; the popup was observed only after data was entered, so a Hostname is typed first.' });
      await wizardFlows.enter('host', target.host);
      await page.getByText('Cancel', { exact: true }).filter({ visible: true }).click();
      await expect(page.getByText('Close the wizard?').filter({ visible: true })).toBeVisible();
      await expect(page.getByText('All changes will be lost.').filter({ visible: true })).toBeVisible();
      await expect(page.getByText('Close', { exact: true }).filter({ visible: true })).toBeVisible();
    });

    await test.step('4. Choose Close; the popup and the wizard close, no item is added and the entered data is discarded', async () => {
      await page.getByText('Close', { exact: true }).filter({ visible: true }).click();
      await expect(page.getByText('Close the wizard?')).toBeHidden();
      await expect(addInventoryItemPage.title).toBeHidden();
      await flows.gotoInventory();
      expect(await inventoryPage.itemCount(), 'the Inventory item count changed after closing the wizard').toBe(itemCountBefore);
      // The data is discarded: a newly opened wizard has an empty Hostname.
      await inventoryPage.openAddWizard();
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      expect((await wizardFlows.fieldState('host')).value, 'the Hostname typed before Close is still there').toBe('');
    });
  },
);
