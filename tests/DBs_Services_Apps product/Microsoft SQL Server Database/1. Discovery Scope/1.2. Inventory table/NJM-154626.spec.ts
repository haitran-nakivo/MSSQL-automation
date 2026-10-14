import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { ALWAYS_ON_TYPE, Pkg03Flows, isSqlRow, type InventoryRow } from '../../../../../flows/pkg-P03.flows';

// NJM-154626: "[DBM-Inv-UI-Table-0004] Verify Item Type Column Display".
// Lab preconditions: signed-in Director with Microsoft SQL Server items in Inventory (today: three standalone instances, one Always On AG and the
//   FCI row, which is Inaccessible); they are only read and opened (no change).
// Inventory side effects: none (read-only; item pages are opened and left).
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory.
// case-vs-ui: the case asks for the item's "actual topology"; the item page's Type field is the reference (Observed), so each discovered row's Item Type is compared with it.
//   An Inaccessible or Failed row has no item page to compare with, so only its Item Type text is checked against the four known type names.
test.use(RUN_OPTIONS);

const KNOWN_TYPES: string[] = [ALWAYS_ON_TYPE, ITEM_TYPES.failoverCluster, ITEM_TYPES.instance, ITEM_TYPES.readScale];

test(
  'NAKIVO Inventory table shows in the Item Type column the topology of each Microsoft SQL Server item',
  { tag: '@NJM-154626' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage }, testInfo) => {
    test.setTimeout(600_000);
    const p03 = new Pkg03Flows(page);
    let sqlRows: InventoryRow[] = [];

    await test.step('1. Precondition: at least one Microsoft SQL Server item is in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      sqlRows = (await p03.readAllRows()).filter(isSqlRow);
      if (sqlRows.length === 0) throw new Error('ABORTED: no Microsoft SQL Server item is listed in Inventory; add one first');
    });

    await test.step('2. Open Settings > Inventory; the Inventory table is displayed', async () => {
      await expect(page).toHaveURL(/\/c\/configuration/);
      expect((await p03.readAllRows()).length).toBeGreaterThan(0);
    });

    await test.step('3. The Item Type column is populated for every SQL item row', async () => {
      for (const row of sqlRows) expect(row.type, `the row "${row.name}" has no Item Type`).not.toBe('');
    });

    await test.step('4. The Item Type of each SQL item is the type name of its topology (instance / failover cluster instance / availability group)', async () => {
      for (const row of sqlRows) expect(KNOWN_TYPES, `the Item Type "${row.type}" of "${row.name}" is not a known Microsoft SQL Server type`).toContain(row.type);
      const comparable = sqlRows.filter((row) => !row.failed && !row.inaccessible && /\d+ databases?/.test(row.details));
      for (const row of comparable) {
        await flows.gotoInventory();
        await flows.openItem(row.name);
        await expect.poll(() => flows.readItemDetails(), { message: `the item page of "${row.name}" does not show its type` }).toMatchObject({ type: row.type });
      }
      await testInfo.attach('compared-rows', { body: JSON.stringify(comparable.map((row) => ({ name: row.name, type: row.type })), null, 2), contentType: 'application/json' });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154626 step 4: rows that are Failed or Inaccessible (today the FCI row) have no item page to compare; only their Item Type text is checked against the known type names.' });
    });
  },
);
