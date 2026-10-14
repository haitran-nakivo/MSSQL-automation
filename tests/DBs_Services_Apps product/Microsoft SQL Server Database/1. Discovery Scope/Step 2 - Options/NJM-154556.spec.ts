import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154556: "[DBM-Inv-UI-Add-Options-0013] Verify Type Dropdown Sorting".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (the dropdown is only opened; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the Jira summary and the specification say "sorted by Name DESC"; the case text only says "the defined order (e.g. alphabetically)". The UI lists the
//   types in ascending order (Always On availability group, failover cluster instance, instance, Read-Scale availability group, Oracle database); the test asserts that order.
test.use(RUN_OPTIONS);

const EXPECTED_ORDER = [
  'Microsoft SQL Server Always On availability group',
  ITEM_TYPES.failoverCluster,
  ITEM_TYPES.instance,
  ITEM_TYPES.readScale,
  'Oracle database',
];

test(
  'NAKIVO Add wizard lists the Type dropdown entries in ascending order',
  { tag: '@NJM-154556' },
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

    await test.step('3. Open the Type dropdown; the entries are listed top to bottom in ascending order', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The specification says sorted by Name DESC; the current UI lists the types in ascending order, which is asserted instead.' });
      await addInventoryItemPage.typeField.click();
      const tops: number[] = [];
      for (const entry of EXPECTED_ORDER) {
        const item = page.getByText(entry, { exact: true }).filter({ visible: true });
        await expect(item, `"${entry}" must be listed exactly once`).toHaveCount(1);
        const box = await item.boundingBox();
        expect(box, `"${entry}" has no position on screen`).not.toBeNull();
        tops.push(box?.y ?? 0);
      }
      const sorted = [...tops].sort((a, b) => a - b);
      expect(tops, `the list is not in the order ${EXPECTED_ORDER.join(' > ')}`).toEqual(sorted);
    });
  },
);
