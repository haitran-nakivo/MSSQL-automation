import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { Pkg03Flows, rowOfKind, type InventoryRow } from '../../../../../flows/pkg-P03.flows';

// NJM-159734: "[MSSQL-Inv-UI-Table-0004-2] Verify Item Type column for 'Microsoft SQL Server Read-Scale availability group' is 'Microsoft SQL Server Read-Scale availability group'".
// Lab preconditions: signed-in Director; a Read-Scale AG item in Inventory, or the Read-Scale target of .env (mssqlReadScaleTarget, today 10.10.33.141 /
//   ReadScaleAG, NOT in Inventory) free to be added by the test; no item named P03-RSAG-TYPE.
// Inventory side effects: when no Read-Scale AG item is listed, adds one named P03-RSAG-TYPE (installs or reuses the transporter on the host) and removes it
//   at the end (Remove host and keep transporter); an item that was already listed is only read.
// case-vs-ui: Xray "Configuration > Inventory" is Settings > Inventory.
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P03-RSAG-TYPE';
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
  'NAKIVO Inventory table shows "Microsoft SQL Server Read-Scale availability group" as the Item Type of a Read-Scale AG item',
  { tag: '@NJM-159734' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, mssqlReadScaleTarget: target }) => {
    test.setTimeout(1_500_000);
    const p03 = new Pkg03Flows(page);
    let row: InventoryRow | null = null;

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
    });

    await test.step('3. The Item Type column is populated for the Read-Scale availability group row', async () => {
      const current = row as unknown as InventoryRow;
      const fresh = rowOfKind(await p03.readAllRows(), 'readScale');
      expect(fresh, `the row "${current.name}" is not listed`).not.toBeNull();
      expect(fresh!.type, 'the Item Type of the Read-Scale row is empty').not.toBe('');
    });

    await test.step('4. The Item Type column displays exactly "Microsoft SQL Server Read-Scale availability group"', async () => {
      const fresh = rowOfKind(await p03.readAllRows(), 'readScale');
      expect(fresh!.type).toBe(ITEM_TYPES.readScale);
    });
  },
);
