import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';
import { ObsBFlows } from '../../../../../flows/pkg-obsB.flows';

// NJM-154624: "[DBM-Inv-UI-Table-0002] Verify Standard Table Behaviors".
// Lab preconditions: Inventory holds several items, among them the SQL items WS2022-SQL2025-19.145, FCI-33.140 and AAG-36.6 (three different item types).
// Inventory side effects: none (only column headers are clicked; the sort order of the grid is not stored).
// case-vs-ui (step 1): the SQL items are the three existing lab items; their names are not host names.
// case-vs-ui (step 2): the Inventory page is Settings > Inventory.
// case-vs-ui (step 3): the sortable column headers are "Inventory item" and "Item Type"; "Details" is not sortable. Clicking a header reorders the rows and a second
//   click reverses the order. The direction of the first click is not asserted: either ascending or descending (case-insensitive text order) is accepted.
// case-vs-ui (step 4): NBR has no search/filter field on the Inventory list (the left menu "Search" is a separate global search), so nothing is filtered or
//   entered; the filter is not verified.
// case-vs-ui (step 5): row selection by a checkbox is not observed (a click on a row name opens the item page), so no row is selected; selection is not verified.
// case-vs-ui (step 6): nothing was filtered or selected; the test asserts that the same set of rows is still listed. Pagination is not observed and not verified.
test.use(RUN_OPTIONS);

const key = (text: string): string => text.toUpperCase();
const ascending = (values: string[]): string[] => [...values].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));

test(
  'NAKIVO Inventory list sorts by the Inventory item and Item Type headers, reverses the order on a second click and does not sort by Details',
  { tag: '@NJM-154624' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const obs = new ObsBFlows(page);
    const required = [LAB_ITEMS.instance, LAB_ITEMS.failoverCluster, LAB_ITEMS.alwaysOn];
    let initialNames: string[] = [];

    await test.step('1. Precondition: several SQL items are present in the Inventory', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154624 step 1: the SQL items are the lab items WS2022-SQL2025-19.145, FCI-33.140 and AAG-36.6.' });
      await flows.gotoInventory();
      for (const name of required) {
        if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      }
    });

    await test.step('2. Open Settings > Inventory: the table is displayed with multiple rows', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154624 step 2: Settings > Inventory.' });
      await expect(inventoryPage.item(LAB_ITEMS.instance)).toBeVisible();
      initialNames = await obs.listedNames();
      expect(initialNames.length).toBeGreaterThan(1);
      for (const header of ['Inventory item', 'Item Type', 'Details']) await expect(obs.columnHeader(header)).toBeVisible();
    });

    await test.step('3. Click a sortable column header: rows are reordered and a second click reverses the order', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154624 step 3: "Inventory item" and "Item Type" are sortable, "Details" is not; the direction of the first click is not asserted.' });
      // "Details" is not sortable: a click leaves the order unchanged.
      await obs.columnHeader('Details').click();
      expect(await obs.listedNames(), 'the Details header changed the row order').toEqual(initialNames);

      await obs.columnHeader('Inventory item').click();
      const firstSort = await obs.listedNames();
      await obs.columnHeader('Inventory item').click();
      const secondSort = await obs.listedNames();
      expect([...firstSort].sort(), 'sorting changed the set of rows').toEqual([...initialNames].sort());
      expect(secondSort, 'a second click on Inventory item did not reverse the order').toEqual([...firstSort].reverse());
      const namesUp = ascending(firstSort);
      expect(
        JSON.stringify(firstSort) === JSON.stringify(namesUp) || JSON.stringify(firstSort) === JSON.stringify([...namesUp].reverse()),
        `the first click on Inventory item did not order the names: ${firstSort.join(' | ')}`,
      ).toBe(true);

      await obs.columnHeader('Item Type').click();
      const typesFirst = await obs.listedTypes();
      await obs.columnHeader('Item Type').click();
      const typesSecond = await obs.listedTypes();
      const upward = ascending(typesFirst);
      const sortedUp = JSON.stringify(typesFirst) === JSON.stringify(upward);
      const sortedDown = JSON.stringify(typesFirst) === JSON.stringify([...upward].reverse());
      expect(sortedUp || sortedDown, `the first click on Item Type did not order the types: ${typesFirst.join(' | ')}`).toBe(true);
      expect(JSON.stringify(typesSecond), 'a second click on Item Type did not reverse the direction').toBe(JSON.stringify(sortedUp ? [...upward].reverse() : upward));
    });

    await test.step('4. Enter a value in the table search/filter field: NBR has none on the Inventory list', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154624 step 4: the Inventory list has no search/filter field; nothing is entered and the filter is not verified.' });
      expect((await obs.listedNames()).length).toBe(initialNames.length);
    });

    await test.step('5. Select a row by its checkbox: not observed in NBR', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154624 step 5: no row selection control is observed (a click on a name opens the item page); no row is selected.' });
      await expect(inventoryPage.item(LAB_ITEMS.instance)).toBeVisible();
    });

    await test.step('6. All rows are shown again', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154624 step 6: nothing was filtered or selected; the test asserts the same rows are listed. Pagination is not observed.' });
      expect([...(await obs.listedNames())].sort()).toEqual([...initialNames].sort());
    });
  },
);
