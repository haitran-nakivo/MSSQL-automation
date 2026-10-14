import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ALWAYS_ON_TYPE, Pkg03Flows, rowOfKind, type InventoryRow } from '../../../../../flows/pkg-P03.flows';

// NJM-159733: "[MSSQL-Inv-UI-Table-0003-2] Verify Item Type column for 'Microsoft SQL Server Always On availability group' is 'Microsoft SQL Server Always On availability group'".
// Lab preconditions: signed-in Director with a Microsoft SQL Server Always On availability group item in Inventory (today AAG-36.6); it is only read.
// Inventory side effects: none (read-only).
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory.
// The row is picked by the words "Always On" in its Item Type, so the exact text asserted in step 4 can still fail.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory table shows "Microsoft SQL Server Always On availability group" as the Item Type of an Always On AG item',
  { tag: '@NJM-159733' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage }) => {
    const p03 = new Pkg03Flows(page);
    let row: InventoryRow | null = null;

    await test.step('1. Precondition: a Microsoft SQL Server Always On availability group item is in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      row = rowOfKind(await p03.readAllRows(), 'alwaysOn');
      if (!row) throw new Error('ABORTED: no Microsoft SQL Server Always On availability group item is listed in Inventory; add one first');
    });

    await test.step('2. Open Settings > Inventory; the Inventory table is displayed', async () => {
      await expect(page).toHaveURL(/\/c\/configuration/);
      expect((await p03.readAllRows()).length).toBeGreaterThan(0);
    });

    await test.step('3. The Item Type column is populated for the Always On availability group item row', async () => {
      const current = row as unknown as InventoryRow;
      expect(current.type, `the Item Type of "${current.name}" is empty`).not.toBe('');
    });

    await test.step('4. The Item Type column displays exactly "Microsoft SQL Server Always On availability group"', async () => {
      const current = row as unknown as InventoryRow;
      expect(current.type).toBe(ALWAYS_ON_TYPE);
    });
  },
);
