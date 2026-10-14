import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { Pkg03Flows, rowOfKind, type InventoryRow } from '../../../../../flows/pkg-P03.flows';

// NJM-154633: "[MSSQL-Inv-UI-Table-0004-1] Verify Icon for Read-Scale AG".
// Lab preconditions: signed-in Director; a Read-Scale AG item in Inventory, or the Read-Scale target of .env (mssqlReadScaleTarget, today 10.10.33.141 /
//   ReadScaleAG, NOT in Inventory) free to be added by the test; no item named P03-RSAG-ICON.
// Inventory side effects: when no Read-Scale AG item is listed, adds one named P03-RSAG-ICON (installs or reuses the transporter on the host) and removes it
//   at the end (Remove host and keep transporter); an item that was already listed is only read.
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory.
// case-vs-ui: the designed icon "SQLD002" has no machine-readable reference, so the test verifies that the row shows a drawn icon and attaches what it is
//   (kind, source, size) for the Read-Scale row and for the other item types as evidence; identity with SQLD002 and distinctness from the Always On icon are not asserted
//   (the spec gives SQLD002 to both AG types).
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P03-RSAG-ICON';
const created = new Set<string>();

test.afterEach(async ({ inventoryFlows }) => {
  for (const name of created) {
    try {
      await inventoryFlows.discardIfPresent(name);
    } catch {
      // Best effort: the original failure is what the report shows.
    }
  }
  created.clear();
});

test(
  'NAKIVO Inventory table shows an icon next to a Microsoft SQL Server Read-Scale availability group item',
  { tag: '@NJM-154633' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const p03 = new Pkg03Flows(page);
    let row: InventoryRow | null = null;
    let limitX = 0;

    await test.step('1. Precondition: a Microsoft SQL Server Read-Scale availability group item is in Inventory', async () => {
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      row = rowOfKind(await p03.readAllRows(), 'readScale');
      if (row) return;
      // None is listed: the test adds its own (named, so that only this item is ever removed by the cleanup).
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
      await flows.startAdd(ITEM_TYPES.readScale);
      const outcome = await flows.submitAdd({ displayName: ITEM_NAME, ...target });
      created.add(ITEM_NAME);
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(ITEM_NAME, 600_000), 'discovery of the Read-Scale AG did not complete').toBe('discovered');
      await flows.gotoInventory();
      await inventoryPage.itemCount();
      row = rowOfKind(await p03.readAllRows(), 'readScale');
      expect(row, 'the added Read-Scale AG is not listed in Inventory').not.toBeNull();
    });

    await test.step('2. Open Settings > Inventory; the Inventory table is displayed', async () => {
      await flows.gotoInventory();
      await expect(page).toHaveURL(/\/c\/configuration/);
      expect((await p03.readAllRows()).length).toBeGreaterThan(0);
      const header = await p03.itemTypeHeaderX();
      expect(header, 'the Item Type header was not found').not.toBeNull();
      limitX = header as number;
    });

    await test.step('3. An icon is displayed next to the Read-Scale availability group item in the Inventory item column', async () => {
      const current = row as unknown as InventoryRow;
      const graphics = await p03.rowGraphics(current.name, limitX);
      expect(graphics.length, `the row "${current.name}" shows no icon left of the Item Type column`).toBeGreaterThan(0);
      await testInfo.attach('read-scale-row-icon', { body: JSON.stringify(graphics, null, 2), contentType: 'application/json' });
    });

    await test.step('4. The icon of the Read-Scale row is a displayed graphic; the icons of the other item types are recorded for comparison', async () => {
      const current = row as unknown as InventoryRow;
      const graphics = await p03.rowGraphics(current.name, limitX);
      expect(graphics.some((graphic) => graphic.width > 0 && graphic.height > 0), 'the icon of the Read-Scale row has no size').toBe(true);
      const rows = await p03.readAllRows();
      const others: Record<string, unknown> = {};
      for (const kind of ['instance', 'failoverCluster', 'alwaysOn'] as const) {
        const other = rowOfKind(rows, kind);
        if (other) others[kind] = { name: other.name, type: other.type, graphics: await p03.rowGraphics(other.name, limitX) };
      }
      await testInfo.attach('other-types-icons', { body: JSON.stringify(others, null, 2), contentType: 'application/json' });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154633 step 4: identity with the designed icon SQLD002 and distinctness from the instance, cluster and Always On icons are not asserted (no reference; the spec gives SQLD002 to both AG types); the icon data is attached as evidence.' });
    });
  },
);
