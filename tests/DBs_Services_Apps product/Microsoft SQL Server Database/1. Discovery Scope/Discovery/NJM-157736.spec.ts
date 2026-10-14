import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-157736: "Verify error420 when credentials have insufficient permission on Failover Cluster (Ref: MSSQL-Disc-0012-2)".
// Lab preconditions: the failover cluster instance target of .env (mssqlFciTarget, host 10.10.33.140) is reachable and healthy and its host is NOT already in
//   Inventory under any name (the Director then answers with the duplicate message and the test ends ABORTED); the low-privilege SQL login of .env
//   (NAKIVO_MSSQL_LOWPERM_SQL_USERNAME / _SQL_PASSWORD) exists on that SQL Server (the owner creates it); no Inventory item named DISC-PERM-FCI.
//   Today FCI-33.140 is in Inventory and Inaccessible (cause unknown): repair the FCI and remove that item first.
// Inventory side effects: adds one item named DISC-PERM-FCI that ends as a Failed row; afterEach cancels it (Failed row > Cancel).
// case-vs-ui (step 1): the UI cannot show that the FCI is online or that the limited login exists; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 3-4): Application is chosen in the Add Inventory Item wizard (Settings > Inventory > +), then the Type combo is set to the failover cluster
//   instance type; one UI action covers both case steps, and the form asks for the WSFC host (Hostname or IP) and the instance name.
// case-vs-ui (steps 5-7): the wizard closes at Finish, the row shows Adding... and then Failed; the error is shown by the row menu Show error, not in the
//   wizard, and the item stays listed as Failed until it is cancelled (the case says it is not added).
// case-vs-ui (step 6): "error 420" is an internal id that the UI does not show; the text of Show error is matched against the words of the case
//   (insufficient / permission / rights / privilege) and attached to the test as evidence.
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
  'NAKIVO user sees an insufficient-permission error and no discovered item when a Microsoft SQL Server failover cluster instance is added with a low-privilege SQL login',
  { tag: '@NJM-157736' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, wizardFlows, inventoryPage, addInventoryItemPage, mssqlFciTarget: target, mssqlLowPermLogin: lowPerm }, testInfo) => {
    test.setTimeout(900_000);
    const displayName = 'DISC-PERM-FCI';
    const form = { displayName, ...target, sqlUsername: lowPerm.sqlUsername, sqlPassword: lowPerm.sqlPassword };

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
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

    await test.step('5. Enter the FCI host and the low-privilege SQL login and start discovery', async () => {
      await flows.fillAddForm(form);
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
      await expect.poll(async () => (await wizardFlows.fieldState('instanceName')).value, { message: 'Instance name does not hold the typed value' }).toBe(target.instanceName);
      await expect.poll(async () => (await wizardFlows.fieldState('username', 1)).value, { message: 'SQL username does not hold the typed value' }).toBe(lowPerm.sqlUsername);
      const outcome = await flows.finishAdd();
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
    });

    await test.step('6. Discovery fails and the error says the credentials have insufficient permission', async () => {
      expect(await flows.waitForDiscovery(displayName, 600_000), 'the add did not end as Failed').toBe('failed');
      const text = await flows.showFailedItemError(displayName);
      await testInfo.attach('show-error-text', { body: text, contentType: 'text/plain' });
      expect(text).toMatch(/insufficient|permission|rights|privilege/i);
      await flows.closeFailedItemError();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157736 step 6: the wizard closes at Finish and the failure shows as a Failed row; the message is read through the row menu Show error, and "error 420" is not displayed.' });
    });

    await test.step('7. The failover cluster instance has not been discovered into Inventory', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toHaveCount(0);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157736 step 7: the item is not discovered, but the UI keeps it listed as a Failed row until it is cancelled; the case says it is not added.' });
    });
  },
);
