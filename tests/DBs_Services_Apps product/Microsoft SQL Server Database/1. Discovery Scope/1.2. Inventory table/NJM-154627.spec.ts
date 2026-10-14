import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { Pkg03Flows, rowOfKind, type InventoryRow } from '../../../../../flows/pkg-P03.flows';

// NJM-154627: "[DBM-Inv-UI-Table-0005] Verify Details Column (DB Count)".
// Lab preconditions: signed-in Director with a discovered standalone Microsoft SQL Server instance item in Inventory (today three, 6 databases each);
//   it is only read and opened (no change).
// Inventory side effects: none (read-only; the item page is opened and left).
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory.
// case-vs-ui: "the actual number of databases" is read from the item page (Total databases), the Director's own list; no SQL Server query is made.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory table shows in the Details column the number of databases discovered for a SQL instance',
  { tag: '@NJM-154627' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage }, testInfo) => {
    const p03 = new Pkg03Flows(page);
    let row: InventoryRow | null = null;

    await test.step('1. Precondition: a discovered Microsoft SQL Server instance item is in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      row = (await p03.readAllRows()).find((candidate) => rowOfKind([candidate], 'instance') !== null && /^\d+ databases?$/.test(candidate.details)) ?? null;
      if (!row) throw new Error('ABORTED: no discovered Microsoft SQL Server instance item (Details "<n> databases") is listed in Inventory; add one first');
    });

    await test.step('2. Open Settings > Inventory; the Inventory table is displayed', async () => {
      await expect(page).toHaveURL(/\/c\/configuration/);
      expect((await p03.readAllRows()).length).toBeGreaterThan(0);
    });

    await test.step('3. The Details column of the instance row shows the database count', async () => {
      const current = row as unknown as InventoryRow;
      await expect(inventoryPage.discoveredDetails(current.name)).toBeVisible();
      expect(current.details).toMatch(/^\d+ databases?$/);
    });

    await test.step('4. The count in Details equals the number of databases discovered for the item', async () => {
      const current = row as unknown as InventoryRow;
      const count = /^(\d+) /.exec(current.details)?.[1] ?? '';
      await flows.openItem(current.name);
      await expect.poll(() => flows.readItemDetails(), { message: `the item page of "${current.name}" does not show the same database count as the table` }).toMatchObject({ totalDatabases: count });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154627 step 4: the "actual number" is the Total databases value of the item page; the databases on the SQL Server itself are not queried.' });
    });
  },
);
