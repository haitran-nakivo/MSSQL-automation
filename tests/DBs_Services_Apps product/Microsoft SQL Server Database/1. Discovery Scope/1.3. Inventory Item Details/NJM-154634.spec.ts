import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS, P09Flows } from '../../../../../flows/pkg-P09.flows';

// NJM-154634: "[DBM-Inv-UI-Details-0001] Verify Application Details UI (Figma)".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 is in Inventory, discovered (shows "N databases") and shows No Issues; on the first run
//   the screenshot baseline does not exist yet (the run writes it and fails once; approve it, later runs compare against it).
// Inventory side effects: none (the item is only read).
// case-vs-ui (steps 2-3): the Inventory page is Settings > Inventory (not Configuration > Inventory); the item page opens by selecting the row.
// case-vs-ui (step 4): NBR 11.2.1 has no top summary bar with count widgets and no "Application details" section: the header shows the item name, the
//   status badge and Edit; the sections are "General information" and "Instance details". The Figma design is not available to the test: the layout check
//   is presence, order, readable text and a screenshot baseline of the CURRENT UI (it detects a change, it is not a Figma match).
// case-vs-ui (step 5): "visual defects" are read as clipped text, text outside the window and overlapping texts.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page of a standalone SQL instance shows its header and sections in order with readable text',
  { tag: '@NJM-154634' },
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
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154634 step 2: the Inventory page is Settings > Inventory.' });
    });

    await test.step('3. Select the SQL item: its item page opens', async () => {
      await flows.openItem(name);
      await expect(inventoryItemPage.text('General information')).toBeVisible();
      await expect(inventoryItemPage.noIssues).toBeVisible();
    });

    await test.step('4. The layout shows the header, General information and Instance details in order', async () => {
      await expect(inventoryItemPage.text('Instance details')).toBeVisible();
      await expect(inventoryItemPage.text('Edit')).toBeVisible();
      for (const label of ['Type:', 'Operating system', 'Instance name:', 'Total databases:', 'SQL version:']) {
        await expect(inventoryItemPage.text(label), `the item page shows no "${label}"`).toBeVisible();
      }
      const header = await layout.measure(name);
      const badge = await layout.measure('No Issues');
      const general = await layout.measure('General information');
      const instance = await layout.measure('Instance details');
      expect(header.top, 'the item name is not above General information').toBeLessThan(general.top);
      expect(badge.top, 'the status badge is not above General information').toBeLessThan(general.top);
      expect(general.top, 'General information is not above Instance details').toBeLessThan(instance.top);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154634 step 4: no summary bar with count widgets and no "Application details" section exist in NBR 11.2.1; the check is the current header and the General information / Instance details sections. The match to the Figma design is not verified.' });
      await expect(layout.detailsContainer()).toHaveScreenshot('njm-154634-instance-item-page.png');
    });

    await test.step('5. All labels and values render without clipping, outside-window text or overlap', async () => {
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
