import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ALWAYS_ON_TYPE } from '../../../../../flows/pkg-P03.flows';

// NJM-154536: "[MSSQL-Inv-UI-Platform-0001-TC02] Verify Navigation to Options Step".
// Lab preconditions: signed-in Director whose license includes Microsoft SQL Server (the Application tile is enabled).
// Inventory side effects: none (the wizard is opened and advanced to the Options step; nothing is typed or added).
// case-vs-ui: Xray "Application/Database > Microsoft SQL Server" is the single "Application" tile of the Platform step.
// case-vs-ui: the Options step shows the Type combo (default Microsoft SQL Server Always On availability group) and the connection and credential fields.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard advances from the Platform step to the Options step when Application is selected and Next is clicked',
  { tag: '@NJM-154536' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    const application = addInventoryItemPage.platformRadio('Application');

    await test.step('1. Precondition: the Add wizard is open on the Platform step with Microsoft SQL Server licensed', async () => {
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true }).filter({ visible: true })).toBeVisible();
      await expect(application).toBeEnabled();
    });

    await test.step('2. Select Application on the Platform step; it is highlighted as selected', async () => {
      await addInventoryItemPage.chooseApplication();
      await expect(application).toBeChecked();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154536 step 2: the Platform step offers the "Application" tile (subtext "Oracle database, Microsoft SQL Server."), not a "Microsoft SQL Server" option.' });
    });

    await test.step('3. Click Next; the wizard leaves the Platform step', async () => {
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(application).toBeHidden();
    });

    await test.step('4. The Options step for Microsoft SQL Server shows the connection details and credentials', async () => {
      await expect(page.getByText(/2\.\s*Options/).filter({ visible: true })).toBeVisible();
      await expect(addInventoryItemPage.typeField).toHaveValue(ALWAYS_ON_TYPE);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 0)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 0)).toBeVisible();
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154536 step 4: the Options step opens with the Type combo on its first value (Always On availability group); the stepper reads "1. Platform, 2. Options".' });
    });
  },
);
