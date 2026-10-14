import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS, P09Flows } from '../../../../../flows/pkg-P09.flows';

// NJM-154636: "[DBM-Inv-UI-Details-0003] Verify Summary Bar Layout".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 is in Inventory, discovered and shows No Issues; on the first run the screenshot
//   baseline does not exist yet (the run writes it and fails once; approve it, later runs compare against it).
// Inventory side effects: none (the item is only read).
// case-vs-ui (steps 2-3): the Inventory page is Settings > Inventory (not Configuration > Inventory).
// case-vs-ui (steps 3-5): NBR 11.2.1 shows no summary bar with 'X Issues' / 'X Databases' / 'X Inaccessible' widgets: the item page header shows the
//   item name and one status badge ("No Issues" here). The test checks that badge (present, fully visible, no overlap) and a screenshot baseline of the
//   CURRENT UI (it detects a change; it is not a Figma match). The widgets 'X Databases' and 'X Inaccessible' and the height, color and font
//   of the "common UI requirements" are not verified.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page header shows its status badge fully visible next to the item name',
  { tag: '@NJM-154636' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const layout = new P09Flows(page);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the standalone SQL instance is discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page: the SQL item is listed', async () => {
      await expect(inventoryPage.item(name)).toBeVisible();
    });

    await test.step('3. Select the SQL item: the item page opens with the status badge at the top', async () => {
      await flows.openItem(name);
      await expect(inventoryItemPage.noIssues).toBeVisible();
      const header = await layout.measure(name);
      const badge = await layout.measure('No Issues');
      expect(badge.top, 'the status badge is not in the header, above General information').toBeLessThan((await layout.measure('General information')).top);
      expect(header.found, 'the item name is not on the item page').toBe(true);
    });

    await test.step('4. The header shows the status badge laid out with the item name', async () => {
      await expect(inventoryItemPage.noIssues).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154636 step 4: NBR 11.2.1 shows no summary bar with the count widgets "X Issues" / "X Databases" / "X Inaccessible"; only the status badge "No Issues" exists. The designed order and the widgets are not verified.' });
      await expect(inventoryItemPage.noIssues).toHaveScreenshot('njm-154636-status-badge.png');
    });

    await test.step('5. The badge text is fully visible with no truncation or overlap', async () => {
      const boxes = await layout.measureAll([name, 'No Issues']);
      for (const box of boxes) {
        expect(box.found, `"${box.text}" is not on the page`).toBe(true);
        expect(box.clipped, `"${box.text}" is clipped`).toBe(false);
        expect(box.insideViewport, `"${box.text}" is outside the window`).toBe(true);
      }
      expect(layout.overlappingPairs(boxes)).toEqual([]);
    });
  },
);
