import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { Pkg03Flows, isSqlRow, rowOfKind, type InventoryRow } from '../../../../../flows/pkg-P03.flows';

// NJM-154625: "[DBM-Inv-UI-Table-0003] Verify Inventory Items Column Format".
// Lab preconditions: signed-in Director with at least one standalone Microsoft SQL Server instance item in Inventory (today three); it is only read.
// Inventory side effects: none (read-only).
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory; the column header reads "Inventory item".
// case-vs-ui: the case compares the name with the Display name the tester added; the lab item is not added by this test, so its name is compared with what the row itself lists.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory table shows an icon followed by the item name in the Inventory item column of a SQL item',
  { tag: '@NJM-154625' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage }, testInfo) => {
    const p03 = new Pkg03Flows(page);
    let row: InventoryRow | null = null;

    await test.step('1. Precondition: a Microsoft SQL Server item is in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      const rows = await p03.readAllRows();
      row = rowOfKind(rows, 'instance') ?? rows.find(isSqlRow) ?? null;
      if (!row) throw new Error('ABORTED: no Microsoft SQL Server item is listed in Inventory; add one first');
      await expect(inventoryPage.item(row.name)).toBeVisible();
    });

    await test.step('2. Open Settings > Inventory; the Inventory table is displayed', async () => {
      await expect(page).toHaveURL(/\/c\/configuration/);
      expect((await p03.readAllRows()).length).toBeGreaterThan(0);
    });

    await test.step('3. The Inventory item cell of the SQL item shows its icon together with its name', async () => {
      const current = row as unknown as InventoryRow;
      const limitX = await p03.itemTypeHeaderX();
      expect(limitX, 'the Item Type header was not found').not.toBeNull();
      const graphics = await p03.rowGraphics(current.name, limitX as number);
      expect(graphics.length, `the row "${current.name}" shows no icon left of the Item Type column`).toBeGreaterThan(0);
      await expect(inventoryPage.item(current.name)).toBeVisible();
      await testInfo.attach('row-icon', { body: JSON.stringify(graphics, null, 2), contentType: 'application/json' });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154625 step 3: the topology icon is detected as a graphic (img, svg, CSS background or pseudo-element) in the cell; the DOM form of the icon is not recorded.' });
    });

    await test.step('4. The name is shown in full, with the icon before it', async () => {
      const current = row as unknown as InventoryRow;
      const limitX = await p03.itemTypeHeaderX();
      const graphics = await p03.rowGraphics(current.name, limitX as number);
      const name = await p03.nameBox(current.name);
      expect(name, `the name "${current.name}" has no box in its row`).not.toBeNull();
      expect(Math.min(...graphics.map((graphic) => graphic.left)), 'the icon does not start before the name').toBeLessThan(name!.left);
      expect(current.name.length, 'the item name is empty').toBeGreaterThan(0);
      await expect(inventoryPage.item(current.name)).toHaveText(current.name);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154625 step 4: alignment "per the design" is checked only as icon-before-name; the name is compared with the row text, not with a Display name typed by this test.' });
    });
  },
);
