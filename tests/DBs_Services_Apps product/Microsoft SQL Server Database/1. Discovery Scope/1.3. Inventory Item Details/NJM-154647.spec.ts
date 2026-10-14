import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS, P09Flows } from '../../../../../flows/pkg-P09.flows';

// NJM-154647: "[MSSQL-Inv-UI-Details-instance-0001] Verify Instance UI Layout".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 is in Inventory and discovered; on the first run the screenshot baseline does not
//   exist yet (the run writes it and fails once; approve it, later runs compare against it).
// Inventory side effects: none (the item is only read).
// case-vs-ui (steps 2-3): the Inventory page is Settings > Inventory.
// case-vs-ui (step 3): NBR 11.2.1 has no summary bar with count widgets; the layout is the header, General information and Instance details. The Figma
//   design is not available: the check is presence, order and a screenshot baseline of the CURRENT UI (it is not a Figma match).
// case-vs-ui (step 4): "no FCI node or AG replica section" is checked as: no "AG name:" field and no visible text with "replica" or "cluster node".
// case-vs-ui (step 5): "visual defects" are read as clipped text, text outside the window and overlapping texts.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page of a standalone SQL instance shows only instance sections with readable text',
  { tag: '@NJM-154647' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const layout = new P09Flows(page);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the standalone SQL instance is discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page and the details of the standalone instance', async () => {
      await expect(inventoryPage.item(name)).toBeVisible();
      await flows.openItem(name);
      await expect(inventoryItemPage.text('General information')).toBeVisible();
    });

    await test.step('3. The layout shows General information and Instance details with the instance fields', async () => {
      await expect(inventoryItemPage.text('Instance details')).toBeVisible();
      for (const label of ['Instance name:', 'Total databases:', 'SQL version:']) {
        await expect(inventoryItemPage.text(label), `the item page shows no "${label}"`).toBeVisible();
      }
      const general = await layout.measure('General information');
      const instance = await layout.measure('Instance details');
      expect(general.top, 'General information is not above Instance details').toBeLessThan(instance.top);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154647 step 3: no summary bar with count widgets exists in NBR 11.2.1. The match to the Figma design is not verified; a screenshot baseline of the current UI is compared.' });
      await expect(layout.detailsContainer()).toHaveScreenshot('njm-154647-instance-item-page.png');
    });

    await test.step('4. No cluster or availability-group section is shown', async () => {
      await expect(inventoryItemPage.text('AG name:')).toHaveCount(0);
      await expect(page.getByText(/replica|cluster node/i).filter({ visible: true })).toHaveCount(0);
    });

    await test.step('5. All sections and values render without clipping, outside-window text or overlap', async () => {
      const boxes = await layout.measureAll([name, 'No Issues', 'General information', 'Instance details', 'Type:', 'Operating system', 'Instance name:', 'Total databases:', 'SQL version:']);
      for (const box of boxes) {
        expect(box.found, `"${box.text}" is not on the page`).toBe(true);
        expect(box.clipped, `"${box.text}" is clipped`).toBe(false);
        expect(box.insideViewport, `"${box.text}" is outside the window`).toBe(true);
      }
      expect(layout.overlappingPairs(boxes)).toEqual([]);
    });
  },
);
