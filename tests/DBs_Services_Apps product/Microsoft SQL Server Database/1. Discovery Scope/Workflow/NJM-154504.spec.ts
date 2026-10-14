import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154504: "[MSSQL-Disc-WF-0014] Verify Credential Validation during Discovery".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in Inventory under
//   any name (the Director then answers with the duplicate message and the test ends ABORTED); no Inventory item named WF-CREDVAL-INSTANCE.
//   Today WS2022-SQL2025-19.145 (the host of mssqlInstanceTarget) is in Inventory: remove it first.
// Inventory side effects: adds one item named WF-CREDVAL-INSTANCE that ends as a Failed row (the test cancels it in step 4), then adds it
//   again with the correct password and waits for its discovery; afterEach removes whichever of the two exists (Cancel when Failed, Remove otherwise).
// case-vs-ui (step 1): the UI cannot show that the host is reachable; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 3-4): the wizard closes at Finish, the row shows Adding... and then Failed; the error is read with the row menu Show error
//   (not in the wizard), and the item stays listed as a Failed row until it is cancelled (the case says no item is added).
// case-vs-ui (step 5): the correct credentials are entered in a new Add wizard after the Failed row was cancelled, not through Retry.
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
  'NAKIVO Add wizard ends a discovery with a wrong SQL password as a Failed item with a credentials error and discovers the instance with the correct password',
  { tag: '@NJM-154504' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, wizardFlows, inventoryPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'WF-CREDVAL-INSTANCE';
    const wrongSqlPassword = `${target.sqlPassword}x`;

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154504 step 1: the UI cannot show that the SQL host is reachable; only a signed-in Director and the Inventory page are checked.' });
    });

    await test.step('2. Open the Add wizard (Application > Microsoft SQL Server, instance) and enter the host with an incorrect SQL password: the form accepts it', async () => {
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await flows.fillAddForm({ displayName, ...target, sqlPassword: wrongSqlPassword });
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
      // Compared as a boolean so that no password can appear in a failure message.
      expect((await wizardFlows.fieldState('password', 1)).value === wrongSqlPassword, 'SQL password does not hold the typed (wrong) value').toBe(true);
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('3. Start discovery with the invalid credentials: it ends with an authentication error', async () => {
      const outcome = await flows.finishAdd();
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'the add did not end as Failed').toBe('failed');
      const text = await flows.showFailedItemError(displayName);
      await testInfo.attach('evidence-3-failed-item-error', { body: text, contentType: 'text/plain' });
      expect(text).toMatch(/Provided SQL credentials are incorrect or have insufficient permissions/);
      await flows.closeFailedItemError();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154504 step 3: discovery is not rejected immediately in the wizard: the wizard closes, the row shows Adding... and then Failed, and the error is read with the row menu Show error.' });
    });

    await test.step('4. Confirm no discovered item was created for the failed attempt', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toHaveCount(0);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154504 step 4: the UI keeps a Failed row for the attempt until it is cancelled; no discovered item exists, and after Cancel the row is gone.' });
      expect(await flows.cancelFailedItem(displayName), 'the Failed row did not leave the Inventory after Cancel').toBe(true);
      await expect(inventoryPage.item(displayName)).toHaveCount(0);
    });

    await test.step('5. Re-enter the correct SQL credentials and start discovery again: the instance is added and discovered', async () => {
      await flows.startAdd(ITEM_TYPES.instance);
      const outcome = await flows.submitAdd({ displayName, ...target });
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish with the correct credentials').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery with the correct credentials did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered instance' })
        .toMatchObject({ type: ITEM_TYPES.instance, instanceName: target.instanceName, noIssues: true });
      await testInfo.attach('evidence-5-item-page', { body: await page.screenshot(), contentType: 'image/png' });
    });
  },
);
