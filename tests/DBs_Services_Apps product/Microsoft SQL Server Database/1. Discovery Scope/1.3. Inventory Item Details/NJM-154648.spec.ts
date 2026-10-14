import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { LAB_ITEMS, P09Flows } from '../../../../../flows/pkg-P09.flows';

// NJM-154648: "[MSSQL-Inv-UI-Details-cluster-0001] Verify FCI UI Layout".
// Lab preconditions: the FCI item FCI-33.140 (host of mssqlFciTarget) is in Inventory and discovered (shows "N databases"). TODAY it is Inaccessible: the
//   test then ends ABORTED until the FCI is repaired. On the first run the screenshot baseline does not exist yet (the run writes it and fails once; approve it).
// Inventory side effects: none (the item is only read).
// case-vs-ui (steps 2-3): the Inventory page is Settings > Inventory; NBR 11.2.1 has no summary bar with count widgets: the layout is the header, General
//   information and Instance details. The Figma design is not available: presence, order and a screenshot baseline of the CURRENT UI are checked (not a Figma match).
// case-vs-ui (step 4): the cluster nodes are not shown on the FCI item page as far as observed; only the FCI type of the item page is checked, the nodes are not.
// case-vs-ui (step 5): "visual defects" are read as clipped text, text outside the window and overlapping texts.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page of a SQL failover cluster instance shows its sections in order with readable text',
  { tag: '@NJM-154648' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const layout = new P09Flows(page);
    const name = LAB_ITEMS.failoverCluster;

    await test.step('1. Precondition: the SQL failover cluster instance is discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      if ((await inventoryPage.discoveredDetails(name).count()) === 0) throw new Error(`ABORTED: "${name}" is not discovered (no database count in its row; it is Inaccessible or Failed); repair it and run again`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page and the details of the FCI', async () => {
      await expect(inventoryPage.item(name)).toBeVisible();
      await flows.openItem(name);
      await expect(inventoryItemPage.text('General information')).toBeVisible();
    });

    await test.step('3. The layout shows General information and Instance details in order', async () => {
      await expect(inventoryItemPage.text('Instance details')).toBeVisible();
      const general = await layout.measure('General information');
      const instance = await layout.measure('Instance details');
      expect(general.top, 'General information is not above Instance details').toBeLessThan(instance.top);
      await expect(inventoryItemPage.noIssues).toBeVisible();
      await expect(layout.detailsContainer()).toHaveScreenshot('njm-154648-fci-item-page.png');
    });

    await test.step('4. The item page is that of a failover cluster instance', async () => {
      await expect.poll(() => flows.readItemDetails(), { message: 'the item page is not that of a failover cluster instance' }).toMatchObject({ type: ITEM_TYPES.failoverCluster });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154648 step 4: the cluster nodes are not shown on the FCI item page as far as observed; they are not verified, only the FCI type.' });
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
