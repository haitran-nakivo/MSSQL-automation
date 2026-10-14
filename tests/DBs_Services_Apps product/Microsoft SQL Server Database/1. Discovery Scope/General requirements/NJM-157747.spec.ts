import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES, REMOVE_OPTIONS } from '../../../../../flows/inventory.flows';

// NJM-157747: "Verify removing Read-Scale AG from Inventory (Ref: MSSQL-Inv-General-0004-2)".
// Lab preconditions: the Read-Scale AG target of .env (mssqlReadScaleTarget, 10.10.33.141, AG ReadScaleAG) is reachable and its host is NOT
//   already in Inventory under any name (duplicate = ABORTED); no Inventory item named P02-157747. The test adds its own item.
// Inventory side effects: adds one item named P02-157747 and removes it (Remove host and keep transporter); afterEach removes it or cancels it if Failed.
// case-vs-ui (step 1): the item is added by the test itself so that the test only ever removes an item it created.
// case-vs-ui (steps 2-3): "Manage > Remove" is the trash icon on the item page; the confirmation offers three transporter choices.
// case-vs-ui (step 4): there is no removal task or Activities entry; the dialog closes and the item leaves the list.
// case-vs-ui (step 5): "child databases removed" is checked as: the item and its database count leave the Inventory list and no other entry
//   is added or lost (the databases are not separate Inventory entries).
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
  'NAKIVO user can remove a Microsoft SQL Server Read-Scale availability group from Inventory and it disappears with its databases',
  { tag: '@NJM-157747' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'P02-157747';
    let itemCountWithItem = 0;

    await test.step('1. Precondition: the Read-Scale AG is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      await flows.startAdd(ITEM_TYPES.readScale);
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the Read-Scale AG did not complete').toBe('discovered');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      itemCountWithItem = await inventoryPage.itemCount();
    });

    await test.step('2. Select the Read-Scale AG item', async () => {
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page of the Read-Scale AG did not open' })
        .toMatchObject({ type: ITEM_TYPES.readScale, agName: target.agName });
    });

    await test.step('3. Click Remove: a confirmation is displayed', async () => {
      await flows.openRemoveDialog();
      await expect(inventoryItemPage.removeDialog).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157747 step 3: Remove is the trash icon on the item page; the confirmation also asks what to do with the transporter.' });
    });

    await test.step('4. Confirm the removal', async () => {
      expect(await flows.confirmRemove(REMOVE_OPTIONS.keepTransporter), 'the Remove dialog did not close after confirming').toBe(true);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157747 step 4: the UI shows no removal task; the dialog closes and the item leaves the list.' });
    });

    await test.step('5. The Read-Scale AG is no longer in Inventory and its databases are removed with it', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.item(displayName)).toHaveCount(0, { timeout: 120_000 });
      created.delete(displayName);
      await expect(inventoryPage.discoveredDetails(displayName)).toHaveCount(0);
      expect(await inventoryPage.itemCount()).toBe(itemCountWithItem - 1);
    });
  },
);
