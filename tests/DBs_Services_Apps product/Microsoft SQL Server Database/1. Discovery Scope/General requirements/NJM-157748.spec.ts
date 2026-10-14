import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-157748: "Verify child databases are discovered for FCI (Ref: MSSQL-Inv-General-0005-2)".
// Lab preconditions: the FCI target of .env (mssqlFciTarget, FCI-33.140) is accessible (today it is Inaccessible, so the add Fails and the test
//   fails) and its host is NOT already in Inventory under any name (duplicate = ABORTED); no Inventory item named P02-157748.
//   Today FCI-33.140 is in Inventory: remove it first.
// Inventory side effects: adds one item named P02-157748; afterEach removes it (keep transporter) or cancels it if Failed.
// case-vs-ui (step 1): the UI cannot show which databases the source hosts; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 2-3): the Add wizard is opened with Settings > Inventory > + and Application is chosen; the type is set in the Options step.
// case-vs-ui (step 4): there is no virtual network name field: Hostname or IP is the WSFC hosting the FCI, plus the instance name.
// case-vs-ui (step 5): there is no tree to expand: the databases are listed on the item page ("Total databases"); tempdb is not listed.
// case-vs-ui (step 6): the list is not compared with the databases on the source (no host-side SQL access); the count on the item page is
//   compared with the count on the Inventory row.
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
  'NAKIVO user sees the databases of an added Microsoft SQL Server failover cluster instance listed on its Inventory item',
  { tag: '@NJM-157748' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, addInventoryItemPage, mssqlFciTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'P02-157748';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
    });

    await test.step('2. Open the Add wizard and choose Application', async () => {
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Choose Microsoft SQL Server (failover cluster instance): the wizard shows the connection fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
    });

    await test.step('4. Enter the host, instance name and credentials and Finish: discovery completes', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the FCI did not complete').toBe('discovered');
    });

    let totalDatabases = '';
    await test.step('5. Open the item: the databases of the FCI are listed', async () => {
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not list the databases of the FCI' })
        .toMatchObject({ instanceName: target.instanceName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
      totalDatabases = (await flows.readItemDetails()).totalDatabases;
      await expect(inventoryItemPage.text('tempdb')).toHaveCount(0);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157748 step 5: the databases are on the item page, there is no node to expand; the tempdb database is not listed.' });
    });

    await test.step('6. The number of listed databases agrees with the Inventory row', async () => {
      await flows.gotoInventory();
      const row = await flows.readRow(displayName);
      expect(row.details, 'the Inventory row does not show the same number of databases as the item page').toMatch(new RegExp(`(^|\\s)${totalDatabases} databases?$`));
      await expect(inventoryPage.item(displayName)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157748 step 6: the databases are not compared with those on the source FCI; only the item page count and the Inventory row count are compared.' });
    });
  },
);
