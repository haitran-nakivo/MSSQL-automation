import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { Pkg03Flows, rowOfKind, type InventoryRow } from '../../../../../flows/pkg-P03.flows';

// NJM-154629: "[DBM-Inv-UI-Table-0007] Verify Details Column Plural Logic".
// Lab preconditions: signed-in Director with a discovered standalone Microsoft SQL Server instance item that holds two or more databases
//   (today three instances with 6 databases each); it is only read and opened (no change).
// Inventory side effects: none (read-only; the item page is opened and left).
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory table writes "<n> databases" in the plural in the Details column of a SQL instance with several databases',
  { tag: '@NJM-154629' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage }) => {
    const p03 = new Pkg03Flows(page);
    let row: InventoryRow | null = null;

    await test.step('1. Precondition: a discovered Microsoft SQL Server instance item with two or more databases is in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      row = (await p03.readAllRows()).find((candidate) => rowOfKind([candidate], 'instance') !== null && /^([2-9]|[1-9]\d+) databases$/.test(candidate.details)) ?? null;
      if (!row) throw new Error('ABORTED: no Microsoft SQL Server instance item with two or more databases is listed in Inventory; add one first');
    });

    await test.step('2. Open Settings > Inventory; the Inventory table is displayed', async () => {
      await expect(page).toHaveURL(/\/c\/configuration/);
      expect((await p03.readAllRows()).length).toBeGreaterThan(0);
    });

    await test.step('3. The Details column of the multi-database instance row shows the count', async () => {
      const current = row as unknown as InventoryRow;
      await expect(inventoryPage.discoveredDetails(current.name)).toBeVisible();
      expect(current.details).toMatch(/^\d+ databases?$/);
    });

    await test.step('4. The Details text uses the plural form "<n> databases", with n equal to the item\'s Total databases', async () => {
      const current = row as unknown as InventoryRow;
      const count = /^(\d+) /.exec(current.details)?.[1] ?? '';
      expect(Number(count)).toBeGreaterThan(1);
      expect(current.details).toBe(`${count} databases`);
      await flows.openItem(current.name);
      await expect.poll(() => flows.readItemDetails(), { message: `the item page of "${current.name}" does not show the same database count as the table` }).toMatchObject({ totalDatabases: count });
    });
  },
);
