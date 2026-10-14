import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154543: "[DBM-Inv-UI-Add-Platform-0006] Verify Navigation to Options".
// Lab preconditions: signed-in Director whose license includes Microsoft SQL Server (the Application tile is enabled).
// Inventory side effects: none (the wizard is opened and advanced to the Options step; nothing is typed or added).
// case-vs-ui: Xray "Application/Database > Microsoft SQL Server" is the single "Application" tile of the Platform step.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the Options step when Next is clicked with Application selected',
  { tag: '@NJM-154543' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    const application = addInventoryItemPage.platformRadio('Application');

    await test.step('1. Precondition: the Add wizard is open on the Platform step with Microsoft SQL Server licensed', async () => {
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true }).filter({ visible: true })).toBeVisible();
      await expect(application).toBeEnabled();
    });

    await test.step('2. Select Application; the option is selected', async () => {
      await addInventoryItemPage.chooseApplication();
      await expect(application).toBeChecked();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154543 step 2: the Platform step offers the "Application" tile, not "Application/Database > Microsoft SQL Server".' });
    });

    await test.step('3. Click Next; the wizard navigates from the Platform step to the Options step', async () => {
      await addInventoryItemPage.next();
      await expect(application).toBeHidden();
      await expect(page.getByText(/2\.\s*Options/).filter({ visible: true })).toBeVisible();
    });

    await test.step('4. The Options step of the Microsoft SQL Server item is displayed', async () => {
      await expect(addInventoryItemPage.typeField).toBeVisible();
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 0)).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
    });
  },
);
