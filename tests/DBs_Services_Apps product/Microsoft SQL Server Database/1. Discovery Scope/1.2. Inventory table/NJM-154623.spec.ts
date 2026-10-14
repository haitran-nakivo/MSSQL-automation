import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { Pkg03Flows, isSqlRow } from '../../../../../flows/pkg-P03.flows';

// NJM-154623: "[DBM-Inv-UI-Table-0001] Verify Inventory Table UI (Figma)".
// Lab preconditions: signed-in Director with at least one Microsoft SQL Server item in Inventory (today: three standalone instances, one
//   Always On AG and the FCI row); none is added or changed.
// Inventory side effects: none (read-only).
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory; the first column header reads "Inventory item" (the case says "Inventory Items").
// case-vs-ui: the match to the approved Figma design (spacing, styling, icon design) cannot be checked by code; only the structure is verified.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory table shows the columns Inventory item, Item Type and Details with every SQL item row populated',
  { tag: '@NJM-154623' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage }, testInfo) => {
    const p03 = new Pkg03Flows(page);

    await test.step('1. Precondition: at least one Microsoft SQL Server item is in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      await expect.poll(async () => (await p03.readAllRows()).filter(isSqlRow).length, { message: 'no Microsoft SQL Server item is listed in Inventory' }).toBeGreaterThan(0);
    });

    await test.step('2. Open Settings > Inventory; the Inventory view shows its items in a table', async () => {
      await expect(page).toHaveURL(/\/c\/configuration/);
      expect((await p03.readAllRows()).length, 'the Inventory table has no rows').toBeGreaterThan(0);
    });

    await test.step('3. Compare the table layout with the Figma design: header row, columns and row layout are present', async () => {
      const headers = await p03.headerOrder(['Inventory item', 'Item Type', 'Details']);
      expect(headers.every((header) => header.x !== null), 'a column header is missing from the table').toBe(true);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154623 step 3: the Figma design is not available to code; only the presence of the header row, the three columns and populated rows is verified (spacing, styling and icon design are not).' });
    });

    await test.step('4. The column headers are Inventory item, Item Type and Details, in that order', async () => {
      const headers = await p03.headerOrder(['Inventory item', 'Item Type', 'Details']);
      expect(headers.map((header) => header.label)).toEqual(['Inventory item', 'Item Type', 'Details']);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154623 step 4: the first header reads "Inventory item", not "Inventory Items"; its styling against Figma is not verified.' });
    });

    await test.step('5. Every SQL item row shows an icon, its name, its type and its details', async () => {
      const limitX = await p03.itemTypeHeaderX();
      expect(limitX, 'the Item Type header was not found').not.toBeNull();
      const sqlRows = (await p03.readAllRows()).filter(isSqlRow);
      for (const row of sqlRows) {
        expect(row.name, 'a SQL row has no name').not.toBe('');
        expect(row.type, `the row "${row.name}" has no Item Type`).not.toBe('');
        expect(row.details, `the row "${row.name}" has no Details`).not.toBe('');
        const graphics = await p03.rowGraphics(row.name, limitX as number);
        expect(graphics.length, `the row "${row.name}" shows no icon left of the Item Type column`).toBeGreaterThan(0);
      }
      await testInfo.attach('sql-rows', { body: JSON.stringify((await p03.readAllRows()).filter(isSqlRow), null, 2), contentType: 'application/json' });
      await testInfo.attach('inventory-table', { body: await page.screenshot(), contentType: 'image/png' });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154623 step 5: the icon is detected as a graphic (img, svg, CSS background or pseudo-element) left of the Item Type column; that it is the designed topology icon and that there are no alignment defects against Figma is not verified.' });
    });
  },
);
