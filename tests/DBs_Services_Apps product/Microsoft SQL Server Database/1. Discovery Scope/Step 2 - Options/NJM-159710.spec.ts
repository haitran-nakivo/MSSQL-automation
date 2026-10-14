import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159710: "[MSSQL-Inv-UI-Options-0028-2] Verify Unsupported Old Version Block - Microsoft SQL Server failover cluster instance".
// Lab preconditions: signed-in Director; the too-old failover cluster target of .env (variable group NAKIVO_MSSQL_OLD_FCI_*, a failover cluster instance on an
//   unsupported old SQL Server version). That group does not exist yet: the test ends ABORTED ("Missing in .env") until the owner configures it. Its host must NOT
//   already be in Inventory; no Inventory item named P08-159710.
// Inventory side effects: Finish may leave one item named P08-159710 as a Failed row (or add nothing); afterEach cancels or removes it. Only this name is touched.
// case-vs-ui (steps 1-3): Xray "Add" > Microsoft SQL Server is the "+" button and the "Application" tile; the UI has no "Step 1 connection details":
//   Step 1 is the Platform and every field is on the "Options" step, which is where the host is entered.
// case-vs-ui (step 5): where the block shows is not known for the current Director: either the wizard stays open, or it closes and the row ends as Failed.
//   "blocked" is asserted as: no discovered item ever appears (Failed row, or the wizard stays open with nothing added).
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P08-159710';
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
  'NAKIVO user cannot add a failover cluster instance that runs an unsupported old SQL Server version',
  { tag: '@NJM-159710' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlOldFciTarget: target }, testInfo) => {
    test.setTimeout(900_000);

    await test.step('1. Open Settings > Inventory; the Inventory list is displayed with the Add button', async () => {
      await flows.gotoInventory();
      // The name is an ordinary one: an existing item with it is not the test's own, so it is never touched.
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
    });

    await test.step('2. Click Add, choose Application (Microsoft SQL Server) and proceed; the Add wizard opens', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" as the platform; the UI offers the "Application" tile. startAdd also sets the failover cluster instance Type.' });
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Proceed to Step 2 - Options; the Options page of the failover cluster instance is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI has no Step 1 connection details (Step 1 is the Platform); the host is entered on the Options step.' });
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
    });

    await test.step('4. Enter valid connection details of a failover cluster instance on an unsupported old SQL Server version; the values are accepted', async () => {
      await flows.fillAddForm({ displayName: ITEM_NAME, ...target });
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
      await expect.poll(async () => (await wizardFlows.fieldState('instanceName')).value, { message: 'Instance name does not hold the typed value' }).toBe(target.instanceName);
    });

    await test.step('5. Click Finish; the addition is blocked: the old SQL Server version is not discovered or added to Inventory', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Where the block shows is not known for the current Director: the wizard stays open, or it closes and the row ends as Failed. Both count as blocked; a discovered item would fail the case.' });
      created.add(ITEM_NAME);
      const outcome = await flows.finishAdd();
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      if (outcome === 'added') {
        expect(await flows.waitForDiscovery(ITEM_NAME, 600_000), 'the unsupported old SQL Server version was discovered or the add did not end').toBe('failed');
        await expect(inventoryPage.discoveredDetails(ITEM_NAME)).toHaveCount(0);
      } else {
        // The wizard stayed open: nothing was added.
        await expect(addInventoryItemPage.title).toBeVisible();
        await flows.gotoInventory();
        expect(await flows.hasItem(ITEM_NAME), 'an item was added although the wizard stayed open').toBe(false);
      }
    });
  },
);
