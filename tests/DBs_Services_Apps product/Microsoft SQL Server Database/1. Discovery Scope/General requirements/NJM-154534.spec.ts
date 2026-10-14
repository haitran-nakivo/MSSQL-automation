import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154534: "[MSSQL-Inv-General-0008-TC02] Verify Connection Failure Handling".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in Inventory under
//   any name (the Director then answers with the duplicate message and the test ends ABORTED); no Inventory item named P02-154534.
//   Today WS2022-SQL2025-19.145 (the host of mssqlInstanceTarget) is in Inventory: remove it first.
// Inventory side effects: adds one item named P02-154534 that ends as a Failed row; afterEach cancels it (Failed row > Cancel).
// case-vs-ui (step 1): the UI cannot show the license; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 2-3): the Add wizard is opened with Settings > Inventory > + and Application is chosen; the type is set in the Options step.
// case-vs-ui (step 4): the connection failure is produced with a wrong SQL password on the reachable lab host (the case allows invalid
//   credentials); an unreachable host was not observed, so it is not used. The form is accepted (no validation error).
// case-vs-ui (steps 5-6): the wizard closes at Finish and the row shows Adding... and then Failed; the error is read through the row menu
//   Show error, not in the wizard, and the item stays listed as Failed until it is cancelled (the case says it is not added).
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
  'NAKIVO user sees a connection failure error and no discovered instance when a Microsoft SQL Server instance is added with invalid credentials',
  { tag: '@NJM-154534' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(900_000);
    const displayName = 'P02-154534';
    const wrongSqlPassword = `${target.sqlPassword}x`;

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
    });

    await test.step('2. Open the Add wizard and choose Application', async () => {
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Choose Microsoft SQL Server (instance): the wizard shows the connection fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
    });

    await test.step('4. Enter connection details that fail (wrong SQL password) and add the instance: discovery fails', async () => {
      await flows.fillAddForm({ displayName, ...target, sqlPassword: wrongSqlPassword });
      const outcome = await flows.finishAdd();
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'the add did not end as Failed').toBe('failed');
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154534 step 4: invalid credentials on a reachable host are used instead of an unreachable host (not observed).' });
    });

    await test.step('5. The failure is explained and the instance is not discovered', async () => {
      const text = await flows.showFailedItemError(displayName);
      expect(text).toMatch(/Cannot add the Microsoft SQL Server instance/);
      expect(text).toMatch(/Provided SQL credentials are incorrect or have insufficient permissions/);
      await flows.closeFailedItemError();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154534 step 5: the error is read through the Failed row menu Show error; the wizard has already closed and the item stays listed as Failed (the case says the wizard does not add it).' });
    });

    await test.step('6. No discovered SQL Server instance was added to Inventory', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toHaveCount(0);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154534 step 6: no instance is discovered, but the UI keeps a Failed row until it is cancelled; the case says no item is created.' });
    });
  },
);
