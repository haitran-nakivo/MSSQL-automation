import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154530: "Verify child databases are discovered for Standalone Instance (Ref: MSSQL-Inv-General-0005-1)".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in Inventory under
//   any name (duplicate = ABORTED); no Inventory item named P02-154530.
// Inventory side effects: adds one item named P02-154530; afterEach removes it (keep transporter) if it is still there.
// case-vs-ui (step 1): the UI cannot show which databases the source hosts; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 2-3): the Add wizard is opened with Settings > Inventory > + and Application is chosen; the type is set in the Options step.
// case-vs-ui (step 4): the form has Hostname or IP and Instance name as separate fields.
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
  'NAKIVO user sees the databases of an added Microsoft SQL Server instance listed on its Inventory item',
  { tag: '@NJM-154530' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'P02-154530';

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

    await test.step('4. Enter the host, instance name and credentials and Finish: discovery completes', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the instance did not complete').toBe('discovered');
    });

    let totalDatabases = '';
    await test.step('5. Open the item: the databases of the instance are listed', async () => {
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not list the databases of the instance' })
        .toMatchObject({ instanceName: target.instanceName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
      totalDatabases = (await flows.readItemDetails()).totalDatabases;
      await expect(inventoryItemPage.text('tempdb')).toHaveCount(0);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154530 step 5: the databases are on the item page, there is no node to expand; the tempdb database is not listed.' });
    });

    await test.step('6. The number of listed databases agrees with the Inventory row', async () => {
      await flows.gotoInventory();
      const row = await flows.readRow(displayName);
      expect(row.details, 'the Inventory row does not show the same number of databases as the item page').toMatch(new RegExp(`(^|\\s)${totalDatabases} databases?$`));
      await expect(inventoryPage.item(displayName)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154530 step 6: the databases are not compared with those on the source instance; only the item page count and the Inventory row count are compared.' });
    });
  },
);
