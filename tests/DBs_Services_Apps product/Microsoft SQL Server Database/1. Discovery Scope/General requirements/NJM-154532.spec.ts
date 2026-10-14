import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES, REMOVE_OPTIONS } from '../../../../../flows/inventory.flows';

// NJM-154532: "Verify child databases are removed when parent is removed (Ref: MSSQL-Inv-General-0007-1)".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in Inventory under
//   any name (duplicate = ABORTED); no Inventory item named P02-154532. Today WS2022-SQL2025-19.145 is in Inventory: remove it first. The test
//   adds its own item (it never removes one it did not create).
// Inventory side effects: adds one item named P02-154532 and removes it (Remove host and keep transporter); afterEach removes it if it is still there.
// case-vs-ui (step 1): the item is added by the test itself; the child databases are visible as the database count of the item.
// case-vs-ui (steps 2-3): "Manage > Remove" is the trash icon on the item page; the confirmation offers three transporter choices.
// case-vs-ui (step 4): there is no removal task or Activities entry; the dialog closes and the item leaves the list.
// case-vs-ui (step 6): the databases are not separate Inventory entries; "no orphaned entries" is checked as: the item's database count is gone
//   from the Inventory list and no other entry is added or lost.
test.use(RUN_OPTIONS);

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
  'NAKIVO user sees no trace of the databases of a Microsoft SQL Server instance in Inventory after the instance is removed',
  { tag: '@NJM-154532' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'P02-154532';
    let itemCountWithItem = 0;

    await test.step('1. Precondition: the instance and its databases are in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      await flows.startAdd(ITEM_TYPES.instance);
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the instance did not complete').toBe('discovered');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
      itemCountWithItem = await inventoryPage.itemCount();
    });

    await test.step('2. Select the instance item', async () => {
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page of the instance did not open' })
        .toMatchObject({ instanceName: target.instanceName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/) });
    });

    await test.step('3. Click Remove: a confirmation is displayed', async () => {
      await flows.openRemoveDialog();
      await expect(inventoryItemPage.removeDialog).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154532 step 3: Remove is the trash icon on the item page; the confirmation also asks what to do with the transporter.' });
    });

    await test.step('4. Confirm the removal: the instance is deleted from Inventory', async () => {
      expect(await flows.confirmRemove(REMOVE_OPTIONS.keepTransporter), 'the Remove dialog did not close after confirming').toBe(true);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154532 step 4: the UI shows no removal task; the dialog closes and the item leaves the list.' });
    });

    await test.step('5. The parent item is no longer listed in Inventory', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.item(displayName)).toHaveCount(0, { timeout: 120_000 });
      created.delete(displayName);
    });

    await test.step('6. The child databases are gone with the parent', async () => {
      await expect(inventoryPage.discoveredDetails(displayName)).toHaveCount(0);
      expect(await inventoryPage.itemCount(), 'the Inventory list gained or lost an entry other than the removed item').toBe(itemCountWithItem - 1);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154532 step 6: the databases are not separate Inventory entries; their absence is checked through the item and its database count leaving the list.' });
    });
  },
);
