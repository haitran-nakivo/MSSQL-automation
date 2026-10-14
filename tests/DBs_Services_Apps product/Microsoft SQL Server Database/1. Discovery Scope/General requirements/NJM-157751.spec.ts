import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { ObsCFlows } from '../../../../../flows/pkg-obsC.flows';
import { SqlHost } from '../../../../../helpers/sql-host';

// NJM-157751: "Verify new databases are detected on update/refresh for FCI (Ref: MSSQL-Inv-General-0006-2)".
// Lab preconditions: the FCI target of .env (mssqlFciTarget, host 10.10.33.140) is reachable from this PC on the SQL port with the
//   SQL login from .env, that login may CREATE and DROP databases, and the host is NOT already in Inventory under any name (duplicate = ABORTED); no item
//   named P02-157751; no database named qa_new_157751 on the FCI. Today FCI-33.140 is in Inventory and Inaccessible: remove it and repair the cluster first.
// Inventory side effects: adds one item named P02-157751 and refreshes it; afterEach drops the database qa_new_157751 (created by this test) and removes the item
//   (keep transporter, or cancel when Failed). Source side effect: one database is created and dropped on the FCI.
// case-vs-ui (step 1): the test adds and discovers the instance itself so that it only refreshes an item it created.
// case-vs-ui (step 2): CREATE DATABASE is sent from this PC with the SQL login (no WinRM at run time).
// case-vs-ui (step 3): "Configuration > Inventory" is Settings > Inventory; Refresh is the Refresh button on the item page.
// case-vs-ui (step 4): the databases are a tree on the item page, there is nothing to expand; after the refresh the item is reopened to read the list.
test.use(RUN_OPTIONS);

const displayName = 'P02-157751';
const newDatabase = 'qa_new_157751';

const created = new Set<string>();
let sql: SqlHost | undefined;
let databaseCreated = false;

test.afterEach(async ({ inventoryFlows }) => {
  if (sql && databaseCreated) {
    try {
      await sql.dropDatabaseIfExists(newDatabase);
    } catch {
      // Best effort: the original failure is what the report shows.
    }
  }
  databaseCreated = false;
  sql = undefined;
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
  'NAKIVO Inventory shows a database created on the SQL Server failover cluster instance after the item is refreshed',
  { tag: '@NJM-157751' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, mssqlFciTarget: target }, testInfo) => {
    test.setTimeout(1_800_000);
    const more = new ObsCFlows(page, flows);
    let before: string[] = [];

    await test.step('1. Precondition: the FCI is in the Inventory with its databases discovered', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the FCI did not complete').toBe('discovered');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await flows.openItem(displayName);
      before = await more.databaseNamesOnPage();
      expect(before.length, 'the item page lists no databases').toBeGreaterThan(0);
      expect(before).not.toContain(newDatabase);
    });

    await test.step('2. On the source instance create a new database: it is created and online', async () => {
      sql = new SqlHost(target.host, target.instanceName, target.sqlUsername, target.sqlPassword);
      if (await sql.identity(newDatabase)) throw new Error(`ABORTED: a database named ${newDatabase} already exists on ${target.host}; drop it and run again`);
      await sql.createDatabase(newDatabase);
      databaseCreated = true;
      expect(await sql.identity(newDatabase), 'the new database is not on the source').toMatchObject({ name: newDatabase, state: 'ONLINE' });
    });

    await test.step('3. In Director open the item and click Refresh: the refresh starts', async () => {
      await flows.gotoInventory();
      await flows.openItem(displayName);
      await more.clickRefresh();
    });

    await test.step('4. After the refresh completes the database list reflects the source', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157751 step 4: the databases are a tree on the item page (nothing to expand); the item is reopened until the list is updated.' });
      await expect
        .poll(() => more.reopenAndReadDatabases(displayName), { timeout: 300_000, intervals: [10_000], message: 'the item page did not list the new database after Refresh' })
        .toContain(newDatabase);
    });

    await test.step('5. The new database is listed under the FCI and the earlier databases are still present', async () => {
      const after = await more.databaseNamesOnPage();
      expect(after).toContain(newDatabase);
      expect(after).toEqual(expect.arrayContaining(before));
    });
  },
);
