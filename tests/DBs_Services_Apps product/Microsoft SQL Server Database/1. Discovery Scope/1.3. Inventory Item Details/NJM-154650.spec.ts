import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { P09Flows } from '../../../../../flows/pkg-P09.flows';

// NJM-154650: "[MSSQL-Inv-UI-Details-RS-0001] Verify Read-Scale AG UI Layout".
// Lab preconditions: the Read-Scale AG host of mssqlReadScaleTarget (10.10.33.141, AG ReadScaleAG) is NOT in Inventory (the test adds it); no Inventory item
//   named RSAG-<host>. If the host is already in Inventory under another name the add ends as a duplicate and the test ends ABORTED. Do not run it in
//   parallel with NJM-154654 (it adds the same host). On the first run the screenshot baseline does not exist yet (the run writes it and fails once; approve it).
// Inventory side effects: adds one item named RSAG-<host>; afterEach removes it (Remove host and keep transporter; a Failed add is cancelled). The host gets
//   a "Physical machine agent" node that stays (keep transporter).
// case-vs-ui (step 1): the test adds and discovers the Read-Scale AG itself (the item is not in the lab Inventory).
// case-vs-ui (steps 2-3): the Inventory page is Settings > Inventory; NBR 11.2.1 has no summary bar with count widgets and no "AG detail widgets": the layout
//   is the header, General information and Instance details (AG name, Total databases, SQL version). The Figma design is not available: presence, order and a
//   screenshot baseline of the CURRENT UI are checked (not a Figma match).
// case-vs-ui (step 4): the item page lists no replicas; only the "N hosts" of the Inventory row is checked. The replicas are not verified.
// case-vs-ui (step 5): "visual defects" are read as clipped text, text outside the window and overlapping texts.
test.use(RUN_OPTIONS);

const created = new Set<string>();

test.afterEach(async ({ inventoryFlows }) => {
  for (const name of created) {
    try {
      await inventoryFlows.discardIfPresent(name);
    } catch {
      // Best effort: the original failure is what the report shows.
    }
  }
  created.clear();
});

test(
  'NAKIVO Inventory item page of a Read-Scale availability group shows its sections in order with readable text',
  { tag: '@NJM-154650' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const layout = new P09Flows(page);
    const name = `RSAG-${target.host}`;
    expect(name.length, 'the Display name must stay within 25 characters').toBeLessThanOrEqual(25);

    await test.step('1. Precondition: the Read-Scale availability group is added and discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(name)) throw new Error(`ABORTED: an Inventory item named "${name}" already exists; remove it and run again`);
      await flows.startAdd(ITEM_TYPES.readScale);
      const outcome = await flows.submitAdd({ displayName: name, ...target });
      created.add(name);
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(name, 600_000), 'discovery of the Read-Scale AG did not complete').toBe('discovered');
      await expect(inventoryPage.row(name).getByText('Failed', { exact: true })).toBeHidden();
    });

    await test.step('2. Open the Inventory page and the details of the Read-Scale AG', async () => {
      await expect(inventoryPage.item(name)).toBeVisible();
      await flows.openItem(name);
      await expect(inventoryItemPage.text('General information')).toBeVisible();
    });

    await test.step('3. The layout shows General information and Instance details with the AG fields in order', async () => {
      await expect(inventoryItemPage.text('Instance details')).toBeVisible();
      await expect(inventoryItemPage.text('AG name:')).toBeVisible();
      await expect(inventoryItemPage.text('Total databases:')).toBeVisible();
      await expect(inventoryItemPage.text('SQL version:')).toBeVisible();
      await expect.poll(() => flows.readItemDetails(), { message: 'the item page does not show the Read-Scale AG' }).toMatchObject({ type: ITEM_TYPES.readScale, agName: target.agName, noIssues: true });
      const general = await layout.measure('General information');
      const instance = await layout.measure('Instance details');
      expect(general.top, 'General information is not above Instance details').toBeLessThan(instance.top);
      await expect(layout.detailsContainer()).toHaveScreenshot('njm-154650-read-scale-item-page.png');
    });

    await test.step('4. The availability group reports its hosts in the Inventory list', async () => {
      await flows.gotoInventory();
      const row = await flows.readRow(name);
      expect(row.details).toMatch(/\d+ hosts?, \d+ databases?/);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154650 step 4: the item page lists no replicas; only the "N hosts" of the Inventory row is checked.' });
      await flows.openItem(name);
    });

    await test.step('5. All sections and values render without clipping, outside-window text or overlap', async () => {
      const boxes = await layout.measureAll([name, 'No Issues', 'General information', 'Instance details', 'Type:', 'Operating system', 'AG name:', 'Total databases:', 'SQL version:']);
      for (const box of boxes) {
        expect(box.found, `"${box.text}" is not on the page`).toBe(true);
        expect(box.clipped, `"${box.text}" is clipped`).toBe(false);
        expect(box.insideViewport, `"${box.text}" is outside the window`).toBe(true);
      }
      expect(layout.overlappingPairs(boxes)).toEqual([]);
    });
  },
);
