import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-157732: "Prevent duplicate entry for FCI (Ref: MSSQL-Disc-0011-2)".
// Lab preconditions: the failover cluster instance target of .env (mssqlFciTarget, host 10.10.33.140) is reachable; no Inventory item named DISC-DUP-FCI or
//   DISC-DUP-FCI-2. If the host of the target is already in Inventory (today FCI-33.140 is, Inaccessible, cause unknown), that item is the precondition and
//   the test adds nothing of its own; if it is not, the test adds it as DISC-DUP-FCI and waits for discovery. Whether the duplicate check works while
//   the existing item is Inaccessible is not known.
// Inventory side effects: possibly adds one item named DISC-DUP-FCI (afterEach removes it, keep transporter); the second add (DISC-DUP-FCI-2) must be
//   rejected; if it is wrongly accepted, afterEach removes that item too. An item of the lab that the test did not create is never touched.
// case-vs-ui (step 1): the UI cannot name the host's existing item (item names do not contain the host); the precondition is met by an existing item or by the
//   item the test adds first, and the Inventory row count is the reference for step 7.
// case-vs-ui (steps 3-4): Application is chosen in the Add Inventory Item wizard (Settings > Inventory > +), then the Type combo is set to the failover cluster
//   instance type; one UI action covers both case steps, and the form asks for the WSFC host (Hostname or IP) and the instance name.
// case-vs-ui (steps 5-6): the Director keeps the wizard open and shows the message in it; there is no pop-up.
// case-vs-ui (step 7): the Inventory "tree" is a table; "listed once" is checked as: no second item was created and the row count did not change.
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
  'NAKIVO Add wizard rejects a Microsoft SQL Server failover cluster instance that is already in Inventory as a duplicate and creates no second item',
  { tag: '@NJM-157732' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, wizardFlows, inventoryPage, addInventoryItemPage, mssqlFciTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const firstName = 'DISC-DUP-FCI';
    const secondName = 'DISC-DUP-FCI-2';
    let itemCountBefore = 0;

    await test.step('1. Precondition: the failover cluster instance is already in Inventory', async () => {
      await flows.gotoInventory();
      if ((await flows.hasItem(firstName)) || (await flows.hasItem(secondName))) {
        throw new Error(`ABORTED: an Inventory item named "${firstName}" or "${secondName}" already exists; remove it and run again`);
      }
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      const outcome = await flows.submitAdd({ displayName: firstName, ...target });
      expect(['added', 'duplicate'], 'the Add wizard neither closed nor reported a duplicate').toContain(outcome);
      if (outcome === 'added') {
        created.add(firstName);
        expect(await flows.waitForDiscovery(firstName, 600_000), 'discovery of the failover cluster instance did not complete').toBe('discovered');
        await flows.gotoInventory();
        await expect(inventoryPage.item(firstName)).toHaveCount(1);
      } else {
        // The host is already in Inventory under another name: that item is the precondition. Leave the wizard without saving.
        await wizardFlows.leave();
        testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157732 step 1: the FCI host was already in Inventory under another name, so the precondition was met by that item and the test added nothing of its own.' });
      }
      itemCountBefore = await inventoryPage.itemCount();
    });

    await test.step('2. Open the Inventory page', async () => {
      await flows.gotoInventory();
      await expect(page).toHaveURL(/configuration/);
    });

    await test.step('3. Open the Add wizard and choose Application', async () => {
      // startAdd opens the wizard, chooses Application, goes to the Options step and sets the Type (case steps 3 and 4 are one UI action).
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('4. Microsoft SQL Server (failover cluster instance): the form shows the host and credential fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('5. Enter the same FCI host and instance and start discovery: the Director detects it is already in Inventory', async () => {
      await flows.fillAddForm({ displayName: secondName, ...target });
      const outcome = await flows.finishAdd();
      // If the Director wrongly accepts the entry, the new item is the test's own and is removed in afterEach.
      if (outcome === 'added') created.add(secondName);
      expect(outcome, 'the Director did not answer with the duplicate message').toBe('duplicate');
    });

    await test.step('6. The duplicate is rejected with a message', async () => {
      await expect(addInventoryItemPage.message(/already added to the inventory as/)).toBeVisible();
      await expect(addInventoryItemPage.message(/Duplicate entries are not allowed/)).toBeVisible();
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('7. The Inventory lists the failover cluster instance only once: no second item is created', async () => {
      await wizardFlows.leave();
      await flows.gotoInventory();
      await expect(inventoryPage.item(secondName)).toHaveCount(0);
      expect(await inventoryPage.itemCount(), 'the number of Inventory items changed').toBe(itemCountBefore);
    });
  },
);
