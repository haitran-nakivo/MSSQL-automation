import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { Pkg03Flows, rowOfKind, type InventoryRow } from '../../../../../flows/pkg-P03.flows';

// NJM-154632: "[MSSQL-Inv-UI-Table-0003-1] Verify Icon for Always On AG".
// Lab preconditions: signed-in Director with a Microsoft SQL Server Always On availability group item in Inventory (today AAG-36.6); it is only read.
// Inventory side effects: none (read-only).
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory.
// case-vs-ui: the designed icon "SQLD002" has no machine-readable reference, so the test verifies that the row shows a drawn icon and attaches what it is
//   (kind, source, size) for the AG row and for the other item types as evidence; identity with SQLD002 and distinctness from the instance / FCI / Read-Scale icons
//   are not asserted (the spec gives SQLD002 to both Always On and Read-Scale AGs).
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory table shows an icon next to a Microsoft SQL Server Always On availability group item',
  { tag: '@NJM-154632' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage }, testInfo) => {
    const p03 = new Pkg03Flows(page);
    let row: InventoryRow | null = null;
    let limitX = 0;

    await test.step('1. Precondition: a Microsoft SQL Server Always On availability group item is in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      row = rowOfKind(await p03.readAllRows(), 'alwaysOn');
      if (!row) throw new Error('ABORTED: no Microsoft SQL Server Always On availability group item is listed in Inventory; add one first');
    });

    await test.step('2. Open Settings > Inventory; the Inventory table is displayed', async () => {
      await expect(page).toHaveURL(/\/c\/configuration/);
      expect((await p03.readAllRows()).length).toBeGreaterThan(0);
      const header = await p03.itemTypeHeaderX();
      expect(header, 'the Item Type header was not found').not.toBeNull();
      limitX = header as number;
    });

    await test.step('3. An icon is displayed next to the Always On availability group item in the Inventory item column', async () => {
      const current = row as unknown as InventoryRow;
      const graphics = await p03.rowGraphics(current.name, limitX);
      expect(graphics.length, `the row "${current.name}" shows no icon left of the Item Type column`).toBeGreaterThan(0);
      await testInfo.attach('always-on-row-icon', { body: JSON.stringify(graphics, null, 2), contentType: 'application/json' });
    });

    await test.step('4. The icon of the Always On row is a displayed graphic; the icons of the other item types are recorded for comparison', async () => {
      const current = row as unknown as InventoryRow;
      const graphics = await p03.rowGraphics(current.name, limitX);
      expect(graphics.some((graphic) => graphic.width > 0 && graphic.height > 0), 'the icon of the Always On row has no size').toBe(true);
      const rows = await p03.readAllRows();
      const others: Record<string, unknown> = {};
      for (const kind of ['instance', 'failoverCluster', 'readScale'] as const) {
        const other = rowOfKind(rows, kind);
        if (other) others[kind] = { name: other.name, type: other.type, graphics: await p03.rowGraphics(other.name, limitX) };
      }
      await testInfo.attach('other-types-icons', { body: JSON.stringify(others, null, 2), contentType: 'application/json' });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154632 step 4: identity with the designed icon SQLD002 and distinctness from the instance, cluster and Read-Scale icons are not asserted (no reference; the spec gives SQLD002 to both AG types); the icon data is attached as evidence.' });
    });
  },
);
