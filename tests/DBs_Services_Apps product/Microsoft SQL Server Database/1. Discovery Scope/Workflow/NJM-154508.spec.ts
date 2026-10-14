import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154508: "[MSSQL-Disc-WF-0021] Verify Duplicate Prevention (Idempotency)".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in Inventory under
//   any name (a duplicate on the first add ends the test ABORTED); no Inventory item named WF-DUP-HOSTA or WF-DUP-HOSTA-2.
//   Today WS2022-SQL2025-19.145 (the host of mssqlInstanceTarget) is in Inventory: remove it first.
// Inventory side effects: adds one item named WF-DUP-HOSTA (waits for its discovery); the second add is rejected and adds nothing (if it were
//   accepted, the item WF-DUP-HOSTA-2 would be removed); afterEach removes the items this test created (keep transporter).
// case-vs-ui (step 1): the UI cannot show that Host A is reachable; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 4-5): the case expects the second discovery to run without error and refresh the entry in place; NBR rejects it: the
//   Add wizard stays open with "... is already added to the inventory as "<name>". Duplicate entries are not allowed.", so the spec asserts
//   that rejection and that the Inventory still holds exactly one entry for Host A.
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
  'NAKIVO Add wizard rejects a second discovery of the same Microsoft SQL Server host as a duplicate and Inventory keeps a single entry',
  { tag: '@NJM-154508' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, wizardFlows, inventoryPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_200_000);
    const displayName = 'WF-DUP-HOSTA';
    const secondName = `${displayName}-2`;
    let itemCountAfterAdd = 0;

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test names is in Inventory', async () => {
      await flows.gotoInventory();
      if ((await flows.hasItem(displayName)) || (await flows.hasItem(secondName))) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" or "${secondName}" already exists; remove it and run again`);
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154508 step 1: the UI cannot show that Host A is reachable; only a signed-in Director and the Inventory page are checked.' });
    });

    await test.step('2. Discover Host A (Application > Microsoft SQL Server, instance) with valid credentials: it is added as a single item', async () => {
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of Host A did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
    });

    await test.step('3. Exactly one Inventory entry exists for Host A', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.row(displayName)).toHaveCount(1);
      itemCountAfterAdd = await inventoryPage.itemCount();
      await testInfo.attach('evidence-3-inventory-after-add', { body: await page.screenshot(), contentType: 'image/png' });
    });

    await test.step('4. Initiate discovery of the same Host A again with the same credentials: the Director rejects it as a duplicate', async () => {
      await flows.startAdd(ITEM_TYPES.instance);
      const outcome = await flows.submitAdd({ displayName: secondName, ...target });
      // If the Director accepted it, the item is the test's own and must be removed.
      if (outcome === 'added') created.add(secondName);
      expect(outcome, 'the Director did not reject the second discovery of Host A as a duplicate').toBe('duplicate');
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.message(new RegExp(`already added to the inventory as "${displayName}"`))).toBeVisible();
      await expect(addInventoryItemPage.message(/Duplicate entries are not allowed/)).toBeVisible();
      await testInfo.attach('evidence-4-duplicate-message', { body: await page.screenshot(), contentType: 'image/png' });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154508 step 4: the second discovery does not run to completion: the wizard stays open with the "Duplicate entries are not allowed" message instead.' });
    });

    await test.step('5. Re-check the Inventory entries for Host A: no duplicate entry was created', async () => {
      await wizardFlows.leave();
      await expect(inventoryPage.row(displayName)).toHaveCount(1);
      await expect(inventoryPage.row(secondName)).toHaveCount(0);
      expect(await inventoryPage.itemCount(), 'the number of Inventory entries changed after the rejected duplicate').toBe(itemCountAfterAdd);
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154508 step 5: there is no in-place refresh through the wizard; the existing entry is unchanged and no second entry exists.' });
    });
  },
);
