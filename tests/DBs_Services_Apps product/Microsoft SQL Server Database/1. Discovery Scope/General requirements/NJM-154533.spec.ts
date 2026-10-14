import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154533: "[MSSQL-Inv-General-0008-TC01] Verify Duplicate Addition Prevention".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable; no Inventory item named P02-154533 or
//   P02-154533-2. If the host of the target is already in Inventory under another name (today WS2022-SQL2025-19.145 is), that item is the
//   "existing item" of the case and the test creates none; otherwise the test adds its own item first.
// Inventory side effects: adds one item named P02-154533 only when the host was not yet in Inventory; afterEach removes it (keep transporter).
//   The second add is rejected and leaves no item. An item that was already in Inventory is never touched.
// case-vs-ui (step 1): the existing item is the host's own Inventory item (see preconditions); no tree or type label is checked.
// case-vs-ui (steps 2-3): the Add wizard is opened with Settings > Inventory > + and Application is chosen; the type is set in the Options step
//   (the instance type, the case names no type).
// case-vs-ui (steps 4-5): the wizard stays open and shows "This Microsoft SQL Server is already added to the inventory as ..." with
//   "Duplicate entries are not allowed"; nothing is added.
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
  'NAKIVO Add wizard refuses a Microsoft SQL Server instance that is already in Inventory and creates no second item',
  { tag: '@NJM-154533' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, wizardFlows, inventoryPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const firstName = 'P02-154533';
    const secondName = 'P02-154533-2';
    let itemCountBefore = 0;

    await test.step('1. Precondition: the instance is already in Inventory', async () => {
      await flows.gotoInventory();
      if ((await flows.hasItem(firstName)) || (await flows.hasItem(secondName))) {
        throw new Error(`ABORTED: an Inventory item named "${firstName}" or "${secondName}" already exists; remove it and run again`);
      }
      await flows.startAdd(ITEM_TYPES.instance);
      const outcome = await flows.submitAdd({ displayName: firstName, ...target });
      if (outcome === 'duplicate') {
        // The host is already in Inventory under another name: that item is the case's existing item. Leave the wizard, nothing is saved.
        await wizardFlows.leave();
      } else {
        created.add(firstName);
        expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
        expect(await flows.waitForDiscovery(firstName, 600_000), 'discovery of the instance did not complete').toBe('discovered');
        await expect(inventoryPage.item(firstName)).toBeVisible();
      }
      await flows.gotoInventory();
      itemCountBefore = await inventoryPage.itemCount();
    });

    await test.step('2. Open the Add wizard and choose Application', async () => {
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Choose Microsoft SQL Server (instance): the wizard shows the connection fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
    });

    let outcome = '';
    await test.step('4. Enter the connection details of the instance that is already in Inventory and add it: the wizard detects it', async () => {
      outcome = await flows.submitAdd({ displayName: secondName, ...target });
      expect(outcome, 'the wizard did not report the instance as already existing').toBe('duplicate');
    });

    await test.step('5. The duplicate is prevented and a message says it is already in Inventory', async () => {
      const message = addInventoryItemPage.message(/already added to the inventory/);
      await expect(message.first()).toBeVisible();
      await expect(message.first()).toContainText('Duplicate entries are not allowed');
      await expect(addInventoryItemPage.title).toBeVisible();
      await testInfo.attach('duplicate-message', { body: (await message.first().innerText()).trim(), contentType: 'text/plain' });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154533 step 5: the message is shown inside the open wizard ("... is already added to the inventory as <name>. Duplicate entries are not allowed.").' });
    });

    await test.step('6. The instance appears only once in Inventory', async () => {
      await wizardFlows.leave();
      await expect(inventoryPage.item(secondName)).toHaveCount(0);
      expect(await inventoryPage.itemCount(), 'the Inventory list changed after the rejected add').toBe(itemCountBefore);
    });
  },
);
