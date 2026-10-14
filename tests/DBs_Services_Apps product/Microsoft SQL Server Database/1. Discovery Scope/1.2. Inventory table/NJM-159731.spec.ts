import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { Pkg03Flows, rowOfKind, type InventoryRow } from '../../../../../flows/pkg-P03.flows';

// NJM-159731: "[MSSQL-Inv-UI-Table-0001-2] Verify Item Type column for ''Microsoft SQL Server instance\" is ''Microsoft SQL Server instance\"".
// Lab preconditions: signed-in Director with a standalone Microsoft SQL Server instance item in Inventory (today three); it is only read.
// Inventory side effects: none (read-only).
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory.
// The row is picked by the word "instance" in its Item Type (and not "failover"), so the exact text asserted in step 4 can still fail.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory table shows "Microsoft SQL Server instance" as the Item Type of a standalone SQL instance item',
  { tag: '@NJM-159731' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage }) => {
    const p03 = new Pkg03Flows(page);
    let row: InventoryRow | null = null;

    await test.step('1. Precondition: a standalone Microsoft SQL Server instance item is in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      row = rowOfKind(await p03.readAllRows(), 'instance');
      if (!row) throw new Error('ABORTED: no standalone Microsoft SQL Server instance item is listed in Inventory; add one first');
    });

    await test.step('2. Open Settings > Inventory; the Inventory table is displayed', async () => {
      await expect(page).toHaveURL(/\/c\/configuration/);
      expect((await p03.readAllRows()).length).toBeGreaterThan(0);
    });

    await test.step('3. The Item Type column is populated for the instance item row', async () => {
      const current = row as unknown as InventoryRow;
      expect(current.type, `the Item Type of "${current.name}" is empty`).not.toBe('');
    });

    await test.step('4. The Item Type column displays exactly "Microsoft SQL Server instance"', async () => {
      const current = row as unknown as InventoryRow;
      expect(current.type).toBe(ITEM_TYPES.instance);
    });
  },
);
