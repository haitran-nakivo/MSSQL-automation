import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { Pkg03Flows, isSqlRow, type InventoryRow } from '../../../../../flows/pkg-P03.flows';

// NJM-154628: "[DBM-Inv-UI-Table-0006] Verify Details Column Singular Logic".
// Lab preconditions: signed-in Director with a discovered Microsoft SQL Server item that holds exactly one database (today the Always On AG AAG-36.6,
//   AG_TESTDB86, 1 database); it is only read and opened (no change). No standalone instance in the lab has a single database.
// Inventory side effects: none (read-only; the item page is opened and left).
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory.
// case-vs-ui: an availability group row reads "<n> hosts, <n> databases" (the case shows only the database count), so the singular form is checked on the database part.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory table writes "1 database" in the singular in the Details column of a SQL item with one database',
  { tag: '@NJM-154628' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage }, testInfo) => {
    const p03 = new Pkg03Flows(page);
    let row: InventoryRow | null = null;

    await test.step('1. Precondition: a discovered Microsoft SQL Server item with exactly one database is in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      row = (await p03.readAllRows()).find((candidate) => isSqlRow(candidate) && /(^|, )1 databases?$/.test(candidate.details)) ?? null;
      if (!row) throw new Error('ABORTED: no Microsoft SQL Server item with exactly one database is listed in Inventory; add one (for example the Always On AG on 10.10.36.6) first');
    });

    await test.step('2. Open Settings > Inventory; the Inventory table is displayed', async () => {
      await expect(page).toHaveURL(/\/c\/configuration/);
      expect((await p03.readAllRows()).length).toBeGreaterThan(0);
    });

    await test.step('3. The Details column of the single-database item row shows the count', async () => {
      const current = row as unknown as InventoryRow;
      await expect(inventoryPage.discoveredDetails(current.name)).toBeVisible();
      expect(current.details).toMatch(/\b1 databases?$/);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154628 step 3: an availability group row reads "<n> host(s), <n> database(s)"; the database count is the last part of the Details text.' });
    });

    await test.step('4. The Details text uses the singular form "1 database", not "1 databases"', async () => {
      const current = row as unknown as InventoryRow;
      expect(current.details).toMatch(/(^|, )1 database$/);
      expect(current.details).not.toMatch(/1 databases/);
      await flows.openItem(current.name);
      await expect.poll(() => flows.readItemDetails(), { message: `the item page of "${current.name}" does not show one database` }).toMatchObject({ totalDatabases: '1' });
    });
  },
);
