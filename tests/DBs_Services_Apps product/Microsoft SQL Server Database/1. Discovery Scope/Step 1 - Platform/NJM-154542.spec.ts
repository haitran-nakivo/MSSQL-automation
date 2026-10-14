import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154542: "[DBM-Inv-UI-Add-Platform-0005] Verify Standard Platform Behavior".
// Lab preconditions: signed-in Director whose license includes Microsoft SQL Server (the Application tile is enabled).
// Inventory side effects: none (platform tiles are clicked in the wizard; Next is never clicked).
// case-vs-ui: Xray "Microsoft SQL Server" option is the "Application" tile of the Platform step; "a different enabled platform" is Virtual.
// case-vs-ui: the case refers to "Inventory tab - CI-2a: Platform" behavior, which is not defined anywhere readable; only single-select and the enabled Next control are verified.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard keeps the platform choice single-select with Next enabled when Application is selected',
  { tag: '@NJM-154542' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    const application = addInventoryItemPage.platformRadio('Application');
    const virtual = addInventoryItemPage.platformRadio('Virtual');
    const checked = page.getByRole('radio', { checked: true });
    const next = page.getByRole('button', { name: 'Next' });

    await test.step('1. Precondition: the Add wizard is open on the Platform step with Microsoft SQL Server licensed', async () => {
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(application).toBeEnabled();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154542 step 1: the Platform step opens with Virtual preselected, so one platform is selected before the user clicks anything.' });
    });

    await test.step('2. Click the Application platform option; it becomes the selected platform', async () => {
      await addInventoryItemPage.chooseApplication();
      await expect(application).toBeChecked();
    });

    await test.step('3. Select a different platform (Virtual) and reselect Application; only one platform is selected at a time', async () => {
      await page.getByText('Virtual', { exact: true }).filter({ visible: true }).first().click();
      await expect(virtual).toBeChecked();
      await expect(application).not.toBeChecked();
      await expect(checked).toHaveCount(1);
      await addInventoryItemPage.chooseApplication();
      await expect(application).toBeChecked();
      await expect(virtual).not.toBeChecked();
      await expect(checked).toHaveCount(1);
    });

    await test.step('4. With a platform selected the Next control is enabled', async () => {
      await expect(next).toBeVisible();
      await expect(next).toBeEnabled();
    });
  },
);
