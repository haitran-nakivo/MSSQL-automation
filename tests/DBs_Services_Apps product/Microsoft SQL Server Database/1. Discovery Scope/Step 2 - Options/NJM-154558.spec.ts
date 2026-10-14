import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154558: "[DBM-Inv-UI-Add-Options-0015] Verify Dynamic Fields by Type".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case leaves <type-A> and <type-B> open; the test uses the Always On availability group (the default) and the standalone instance.
//   The type-specific field is "AG name" for the availability group types and "Instance name" for the instance and failover cluster instance types.
test.use(RUN_OPTIONS);

const AVAILABILITY_GROUP_TYPE = 'Microsoft SQL Server Always On availability group';

test(
  'NAKIVO Add wizard shows the AG name field for an availability group and the Instance name field for an instance, switching with the Type',
  { tag: '@NJM-154558' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
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

    await test.step('3. Select the Always On availability group type; the form shows AG name and no Instance name', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case leaves <type-A> open; the test uses the Always On availability group type (the wizard default).' });
      await addInventoryItemPage.chooseType(AVAILABILITY_GROUP_TYPE);
      await expect(addInventoryItemPage.typeField).toHaveValue(AVAILABILITY_GROUP_TYPE);
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
      expect(await wizardFlows.fieldCount('instanceName'), 'Instance name must not be shown for an availability group').toBe(0);
      expect(await wizardFlows.fieldCount('username'), 'OS and SQL username fields').toBe(2);
    });

    await test.step('4. Change the Type to the instance type; the form updates to show Instance name and no AG name', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case leaves <type-B> open; the test uses the Microsoft SQL Server instance type.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
      await expect.poll(() => wizardFlows.fieldCount('availabilityGroupName'), { message: 'AG name must not be shown for an instance' }).toBe(0);
      expect(await wizardFlows.fieldCount('username'), 'OS and SQL username fields').toBe(2);
    });
  },
);
