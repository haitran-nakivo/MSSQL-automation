import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS, P09Flows } from '../../../../../flows/pkg-P09.flows';

// NJM-154649: "[MSSQL-Inv-UI-AO-0001] Verify Always On AG UI Layout".
// Lab preconditions: the Always On AG item AAG-36.6 (host 10.10.36.6, single-replica Basic AG) is in Inventory and discovered (shows "N hosts, N databases").
//   On the first run the screenshot baseline does not exist yet (the run writes it and fails once; approve it, later runs compare against it).
//   The .env AG target (mssqlAgTarget) must point at the AG of this item (10.10.36.6 / AG_TESTDB86; today it still holds the old 10.10.38.76 / AG_TESTDB84).
// Inventory side effects: none (the item is only read).
// case-vs-ui (steps 2-3): the Inventory page is Settings > Inventory; NBR 11.2.1 has no summary bar with count widgets and no "AG details" widget: the layout
//   is the header, General information and Instance details (AG name, Total databases, SQL version). The Figma design is not available: presence, order and a
//   screenshot baseline of the CURRENT UI are checked (not a Figma match).
// case-vs-ui (step 4): the item page lists no availability replicas or roles; the Inventory row reports the number of hosts ("N hosts") and that is what is
//   checked. The replicas with primary/secondary roles are not verified (the lab AG has one replica).
// case-vs-ui (step 5): "visual defects" are read as clipped text, text outside the window and overlapping texts.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page of an Always On availability group shows its sections in order with readable text',
  { tag: '@NJM-154649' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page, mssqlAgTarget: target }, testInfo) => {
    test.setTimeout(300_000);
    const layout = new P09Flows(page);
    const name = LAB_ITEMS.alwaysOn;

    await test.step('1. Precondition: the Always On availability group is discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.completedDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page and the details of the availability group', async () => {
      await expect(inventoryPage.item(name)).toBeVisible();
      await flows.openItem(name);
      await expect(inventoryItemPage.text('General information')).toBeVisible();
    });

    await test.step('3. The layout shows General information and Instance details with the AG fields in order', async () => {
      await expect(inventoryItemPage.text('Instance details')).toBeVisible();
      await expect(inventoryItemPage.text('AG name:')).toBeVisible();
      await expect(inventoryItemPage.text('Total databases:')).toBeVisible();
      await expect(inventoryItemPage.text('SQL version:')).toBeVisible();
      await expect.poll(() => flows.readItemDetails(), { message: 'the item page does not show the configured availability group' }).toMatchObject({ agName: target.agName, noIssues: true });
      const general = await layout.measure('General information');
      const instance = await layout.measure('Instance details');
      expect(general.top, 'General information is not above Instance details').toBeLessThan(instance.top);
      await expect(layout.detailsContainer()).toHaveScreenshot('njm-154649-always-on-item-page.png');
    });

    await test.step('4. The availability group reports its hosts in the Inventory list', async () => {
      await flows.gotoInventory();
      const row = await flows.readRow(name);
      expect(row.details).toMatch(/\d+ hosts?, \d+ databases?/);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154649 step 4: the item page lists no availability replicas or their roles; only the "N hosts" of the Inventory row is checked.' });
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
