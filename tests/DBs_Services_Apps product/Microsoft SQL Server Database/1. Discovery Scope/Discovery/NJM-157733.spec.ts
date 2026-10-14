import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-157733: "Prevent duplicate entry for AAG (Ref: MSSQL-Disc-0011-3)".
// Lab preconditions: the Always On availability group target of .env (mssqlAgTarget) is reachable; no Inventory item named DISC-DUP-AAG or DISC-DUP-AAG-2.
//   If the host of the target is already in Inventory (today AAG-36.6, 10.10.36.6, is), that item is the precondition and the test adds nothing of its own;
//   if it is not, the test adds it as DISC-DUP-AAG and waits for discovery. The .env AG variables still point at the old host 10.10.38.76 / AG_TESTDB84:
//   update .env to 10.10.36.6 / AG_TESTDB86 first.
// Inventory side effects: possibly adds one item named DISC-DUP-AAG (afterEach removes it, keep transporter); the second add (DISC-DUP-AAG-2) must be
//   rejected; if it is wrongly accepted, afterEach removes that item too. An item of the lab that the test did not create is never touched.
// case-vs-ui (step 1): the UI cannot name the host's existing item (item names do not contain the host); the precondition is met by an existing item or by the
//   item the test adds first, and the Inventory row count is the reference for step 7.
// case-vs-ui (steps 3-4): Application is chosen in the Add Inventory Item wizard (Settings > Inventory > +); the default Type is Always On availability
//   group; one UI action covers both case steps, and the form asks for the WSFC host (Hostname or IP) and the AG name, not a listener and an instance.
// case-vs-ui (steps 5-6): the Director keeps the wizard open and shows the message in it; there is no pop-up.
// case-vs-ui (step 7): the Inventory "tree" is a table; "listed once" is checked as: no second item was created and the row count did not change.
test.use(RUN_OPTIONS);

const AAG_TYPE = 'Microsoft SQL Server Always On availability group';

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
  'NAKIVO Add wizard rejects a Microsoft SQL Server Always On availability group that is already in Inventory as a duplicate and creates no second item',
  { tag: '@NJM-157733' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, wizardFlows, inventoryPage, addInventoryItemPage, mssqlAgTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const firstName = 'DISC-DUP-AAG';
    const secondName = 'DISC-DUP-AAG-2';
    let itemCountBefore = 0;

    await test.step('1. Precondition: the Always On availability group is already in Inventory', async () => {
      await flows.gotoInventory();
      if ((await flows.hasItem(firstName)) || (await flows.hasItem(secondName))) {
        throw new Error(`ABORTED: an Inventory item named "${firstName}" or "${secondName}" already exists; remove it and run again`);
      }
      await flows.startAdd();
      const outcome = await flows.submitAdd({ displayName: firstName, ...target });
      expect(['added', 'duplicate'], 'the Add wizard neither closed nor reported a duplicate').toContain(outcome);
      if (outcome === 'added') {
        created.add(firstName);
        expect(await flows.waitForDiscovery(firstName, 600_000), 'discovery of the availability group did not complete').toBe('discovered');
        await flows.gotoInventory();
        await expect(inventoryPage.item(firstName)).toHaveCount(1);
      } else {
        // The host is already in Inventory under another name: that item is the precondition. Leave the wizard without saving.
        await wizardFlows.leave();
        testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157733 step 1: the AAG host was already in Inventory under another name, so the precondition was met by that item and the test added nothing of its own.' });
      }
      itemCountBefore = await inventoryPage.itemCount();
    });

    await test.step('2. Open the Inventory page', async () => {
      await flows.gotoInventory();
      await expect(page).toHaveURL(/configuration/);
    });

    await test.step('3. Open the Add wizard and choose Application', async () => {
      // startAdd opens the wizard, chooses Application and goes to the Options step; the default Type is kept (case steps 3 and 4 are one UI action).
      await flows.startAdd();
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('4. Microsoft SQL Server (Always On availability group): the form shows the host and credential fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(AAG_TYPE);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('5. Enter the same availability group host and name and start discovery: the Director detects it is already in Inventory', async () => {
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

    await test.step('7. The Inventory lists the availability group only once: no second item is created', async () => {
      await wizardFlows.leave();
      await flows.gotoInventory();
      await expect(inventoryPage.item(secondName)).toHaveCount(0);
      expect(await inventoryPage.itemCount(), 'the number of Inventory items changed').toBe(itemCountBefore);
    });
  },
);
