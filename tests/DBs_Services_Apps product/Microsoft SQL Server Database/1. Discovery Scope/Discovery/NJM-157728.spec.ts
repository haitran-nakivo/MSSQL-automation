import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-157728: "Support BULK-LOGGED backup on FCI (Ref: MSSQL-Disc-0010-2)".
// Lab preconditions: the failover cluster instance target of .env (mssqlFciTarget, host 10.10.33.140) is reachable and healthy, has at least one database,
//   and its host is NOT already in Inventory under any name (the Director then answers with the duplicate message and the test ends ABORTED); no Inventory
//   item named DISC-BULK-FCI. Today FCI-33.140 is in Inventory and Inaccessible (cause unknown): repair the FCI and remove that item first.
// Inventory side effects: adds one item named DISC-BULK-FCI; afterEach removes it (Remove host and keep transporter; a Failed add is cancelled).
// case-vs-ui (step 1): the UI cannot show that the FCI is online nor the recovery model of a database; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 3-5): Application is chosen in the Add Inventory Item wizard (Settings > Inventory > +), then the Type combo is set to the failover cluster
//   instance type; one UI action covers case steps 3-5, and the form asks for the WSFC host (Hostname or IP) and the instance name.
// case-vs-ui (step 7): NBR shows no recovery model; only that the databases are discovered (count of the item page) is verified.
// case-vs-ui (step 8): there is no separate Save: Finish saves the item and discovery runs afterwards; the Inventory "tree" is a table.
test.use(RUN_OPTIONS);

const DATABASE_COUNT = /^[1-9]\d*$/;

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
  'NAKIVO user can add a Microsoft SQL Server failover cluster instance and sees its databases discovered with no issues, whatever their recovery model',
  { tag: '@NJM-157728' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, inventoryItemPage, addInventoryItemPage, mssqlFciTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'DISC-BULK-FCI';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157728 step 1: the UI cannot show that the FCI is online or its recovery model; only the signed-in Director and the Inventory page are checked.' });
    });

    await test.step('2. Open the Inventory page', async () => {
      await flows.gotoInventory();
      await expect(page).toHaveURL(/configuration/);
    });

    await test.step('3. Open the Add wizard and choose Application', async () => {
      // startAdd opens the wizard, chooses Application, goes to the Options step and sets the Type (case steps 3, 4 and 5 are one UI action).
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('4. The Type list is set to the Microsoft SQL Server failover cluster instance type', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
    });

    await test.step('5. The form shows the host and credential fields', async () => {
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('6. Enter the FCI host and credentials and start discovery: it completes without error', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the failover cluster instance did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
    });

    await test.step('7. The databases of the failover cluster instance are discovered', async () => {
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show discovered databases' })
        .toMatchObject({ totalDatabases: expect.stringMatching(DATABASE_COUNT) });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157728 step 7: the UI shows no recovery model; only that databases are discovered is verified (the BULK_LOGGED recovery model is not).' });
    });

    await test.step('8. The failover cluster instance is listed in Inventory with no issues', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
      await flows.openItem(displayName);
      await expect(inventoryItemPage.noIssues).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157728 step 8: Finish saves the item (there is no separate Save); the Inventory list is a table, and "no alarms" is the No Issues badge of the item page.' });
    });
  },
);
