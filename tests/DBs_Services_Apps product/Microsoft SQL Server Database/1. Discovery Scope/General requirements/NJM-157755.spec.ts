import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { REMOVE_OPTIONS } from '../../../../../flows/inventory.flows';

// NJM-157755: "Verify child databases are removed when parent AAG is removed (Ref: MSSQL-Inv-General-0007-3)".
// Lab preconditions: the Always On AG target of .env (mssqlAgTarget) is reachable and its host is NOT already in Inventory under any name
//   (duplicate = ABORTED); no Inventory item named P02-157755. The .env AG target still points at the old 10.10.38.76 / AG_TESTDB84: the owner must
//   set it to 10.10.36.6 / AG_TESTDB86. Today AAG-36.6 is in Inventory: remove it first. The test adds its own item.
// Inventory side effects: adds one item named P02-157755 and removes it (Remove host and keep transporter); afterEach removes it or cancels it if Failed.
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
  'NAKIVO user sees no trace of the databases of a Microsoft SQL Server Always On availability group in Inventory after it is removed',
  { tag: '@NJM-157755' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, mssqlAgTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'P02-157755';
    let itemCountWithItem = 0;

    await test.step('1. Precondition: the Always On AG and its databases are in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      await flows.startAdd();
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the Always On AG did not complete').toBe('discovered');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
      itemCountWithItem = await inventoryPage.itemCount();
    });

    await test.step('2. Select the Always On AG item', async () => {
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page of the Always On AG did not open' })
        .toMatchObject({ agName: target.agName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/) });
    });

    await test.step('3. Click Remove: a confirmation is displayed', async () => {
      await flows.openRemoveDialog();
      await expect(inventoryItemPage.removeDialog).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157755 step 3: Remove is the trash icon on the item page; the confirmation also asks what to do with the transporter.' });
    });

    await test.step('4. Confirm the removal: the Always On AG is deleted from Inventory', async () => {
      expect(await flows.confirmRemove(REMOVE_OPTIONS.keepTransporter), 'the Remove dialog did not close after confirming').toBe(true);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157755 step 4: the UI shows no removal task; the dialog closes and the item leaves the list.' });
    });

    await test.step('5. The parent item is no longer listed in Inventory', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.item(displayName)).toHaveCount(0, { timeout: 120_000 });
      created.delete(displayName);
    });

    await test.step('6. The child databases are gone with the parent', async () => {
      await expect(inventoryPage.discoveredDetails(displayName)).toHaveCount(0);
      expect(await inventoryPage.itemCount(), 'the Inventory list gained or lost an entry other than the removed item').toBe(itemCountWithItem - 1);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157755 step 6: the databases are not separate Inventory entries; their absence is checked through the item and its database count leaving the list.' });
    });
  },
);
