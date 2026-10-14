import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154616: "[MSSQL-Inv-UI-Options-0028-1] Verify Unsupported Old Version Block - Microsoft SQL Server instance".
// Lab preconditions: the too-old standalone instance target (mssqlOldInstanceTarget: .env NAKIVO_MSSQL_OLD_INSTANCE_*, a SQL Server older than the
//   supported 2016-2025, reachable from the Director) exists; it does not exist in the lab today, so the test aborts with "Missing in .env" until the owner
//   adds it. Its host must NOT already be in Inventory; no Inventory item named P07-154616.
// Inventory side effects: adds one item named P07-154616 that must end as a Failed row; afterEach cancels it (Failed row > Cancel).
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is "Settings > Inventory", the "+" button, the "Application" tile and the Type "Microsoft SQL Server instance".
// case-vs-ui: how NBR 11.2.1 presents the block is not observed; it is asserted as for other failed adds: the wizard closes, the row ends as Failed and is
//   never discovered (no database count); the case says the instance is not added, NBR keeps the Failed row until Cancel.
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P07-154616';
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
  'NAKIVO Director does not discover a Microsoft SQL Server instance of an unsupported old version',
  { tag: '@NJM-154616' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlOldInstanceTarget: target }, testInfo) => {
    test.setTimeout(900_000);

    await test.step('1. Precondition: an unsupported old Microsoft SQL Server host is reachable and Director is up', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Reachability of the old SQL host cannot be checked from the UI; the target values come from .env.' });
      await flows.gotoInventory();
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
    });

    await test.step('2. Open Add, choose Application (Microsoft SQL Server) and the instance type; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile. startAdd opens the wizard and sets the Type in one call.' });
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
    });

    await test.step('3. Enter the instance name and valid credentials for the old-version host; the fields accept the values', async () => {
      await flows.fillAddForm({ displayName: ITEM_NAME, ...target });
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('instanceName')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('username', 1)).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('4. Click Finish and let the version check run; the add starts', async () => {
      const outcome = await flows.finishAdd();
      created.add(ITEM_NAME);
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
    });

    await test.step('5. Observe the result; adding is blocked and discovery is not performed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Blocked shows as a Failed row that stays listed until Cancel; the case says the instance is not added.' });
      expect(await flows.waitForDiscovery(ITEM_NAME, 600_000), 'the add of the unsupported old version did not end as Failed').toBe('failed');
      await flows.gotoInventory();
      await expect(inventoryPage.row(ITEM_NAME).getByText('Failed', { exact: true })).toBeVisible();
      await expect(inventoryPage.discoveredDetails(ITEM_NAME)).toHaveCount(0);
    });
  },
);
