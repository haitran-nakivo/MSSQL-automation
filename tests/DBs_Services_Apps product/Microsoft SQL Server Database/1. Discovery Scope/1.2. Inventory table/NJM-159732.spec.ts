import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { Pkg03Flows, rowOfKind, type InventoryRow } from '../../../../../flows/pkg-P03.flows';

// NJM-159732: "[MSSQL-Inv-UI-Table-0002-2] Verify Item Type column for '''Microsoft SQL Server failover cluster instance'\" is '''Microsoft SQL Server failover cluster instance'\"".
// Lab preconditions: signed-in Director with a Microsoft SQL Server failover cluster instance item in Inventory (today FCI-33.140, state Inaccessible; the
//   Item Type is shown for that state too); it is only read.
// Inventory side effects: none (read-only).
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory.
// The row is picked by the words "failover cluster" in its Item Type, so the exact text asserted in step 4 can still fail.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory table shows "Microsoft SQL Server failover cluster instance" as the Item Type of a failover cluster item',
  { tag: '@NJM-159732' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage }) => {
    const p03 = new Pkg03Flows(page);
    let row: InventoryRow | null = null;

    await test.step('1. Precondition: a Microsoft SQL Server failover cluster instance item is in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      row = rowOfKind(await p03.readAllRows(), 'failoverCluster');
      if (!row) throw new Error('ABORTED: no Microsoft SQL Server failover cluster instance item is listed in Inventory; add one first');
    });

    await test.step('2. Open Settings > Inventory; the Inventory table is displayed', async () => {
      await expect(page).toHaveURL(/\/c\/configuration/);
      expect((await p03.readAllRows()).length).toBeGreaterThan(0);
    });

    await test.step('3. The Item Type column is populated for the failover cluster item row', async () => {
      const current = row as unknown as InventoryRow;
      expect(current.type, `the Item Type of "${current.name}" is empty`).not.toBe('');
    });

    await test.step('4. The Item Type column displays exactly "Microsoft SQL Server failover cluster instance"', async () => {
      const current = row as unknown as InventoryRow;
      expect(current.type).toBe(ITEM_TYPES.failoverCluster);
    });
  },
);
