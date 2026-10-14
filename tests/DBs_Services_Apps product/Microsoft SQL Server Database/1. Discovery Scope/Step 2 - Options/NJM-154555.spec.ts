import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154555: "[DBM-Inv-UI-Add-Options-0012] Verify Type Dropdown List Content".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (the dropdown is only opened; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case names no entries ("the types defined in the specification"). The UI lists five: the four Microsoft SQL Server types and
//   "Oracle database" (the Application platform covers both); the test asserts these five, each once.
test.use(RUN_OPTIONS);

const ENTRIES = [
  'Microsoft SQL Server Always On availability group',
  ITEM_TYPES.failoverCluster,
  ITEM_TYPES.instance,
  ITEM_TYPES.readScale,
  'Oracle database',
];

test(
  'NAKIVO Add wizard lists the Microsoft SQL Server types and Oracle database in the Type dropdown, each once',
  { tag: '@NJM-154555' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
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

    await test.step('3. Open the Type dropdown; it lists the five entries of the current UI, none missing and none repeated', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case does not name the entries. The UI lists the four Microsoft SQL Server types and "Oracle database"; no other entry is asserted absent because the list has no locator for its size.' });
      await addInventoryItemPage.typeField.click();
      for (const entry of ENTRIES) {
        await expect(page.getByText(entry, { exact: true }).filter({ visible: true }), `"${entry}" must be listed exactly once`).toHaveCount(1);
      }
    });
  },
);
