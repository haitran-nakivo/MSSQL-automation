import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { ObsCFlows } from '../../../../../flows/pkg-obsC.flows';
import { SqlHost } from '../../../../../helpers/sql-host';

// NJM-154531: "Verify new databases are detected on update/refresh (Ref: MSSQL-Inv-General-0006-1)".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget, host 10.10.19.145) is reachable from this PC on the SQL port with the
//   SQL login from .env, that login may CREATE and DROP databases, and the host is NOT already in Inventory under any name (duplicate = ABORTED); no item
//   named P02-154531; no database named qa_new_154531 on the instance. Today WS2022-SQL2025-19.145 is in Inventory: remove it first.
// Inventory side effects: adds one item named P02-154531 and refreshes it; afterEach drops the database qa_new_154531 (created by this test) and removes the item
//   (keep transporter, or cancel when Failed). Source side effect: one database is created and dropped on the instance.
// case-vs-ui (step 1): the test adds and discovers the instance itself so that it only refreshes an item it created.
// case-vs-ui (step 2): CREATE DATABASE is sent from this PC with the SQL login (no WinRM at run time).
// case-vs-ui (step 3): "Configuration > Inventory" is Settings > Inventory; Refresh is the Refresh button on the item page.
// case-vs-ui (step 4): the databases are a tree on the item page, there is nothing to expand; after the refresh the item is reopened to read the list.
test.use(RUN_OPTIONS);

const displayName = 'P02-154531';
const newDatabase = 'qa_new_154531';

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
  'NAKIVO Inventory shows a database created on the standalone SQL Server instance after the item is refreshed',
  { tag: '@NJM-154531' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_800_000);
    const more = new ObsCFlows(page, flows);
    let before: string[] = [];

    await test.step('1. Precondition: the standalone instance is in the Inventory with its databases discovered', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      await flows.startAdd(ITEM_TYPES.instance);
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the instance did not complete').toBe('discovered');
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
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154531 step 4: the databases are a tree on the item page (nothing to expand); the item is reopened until the list is updated.' });
      await expect
        .poll(() => more.reopenAndReadDatabases(displayName), { timeout: 300_000, intervals: [10_000], message: 'the item page did not list the new database after Refresh' })
        .toContain(newDatabase);
    });

    await test.step('5. The new database is listed under the instance and the earlier databases are still present', async () => {
      const after = await more.databaseNamesOnPage();
      expect(after).toContain(newDatabase);
      expect(after).toEqual(expect.arrayContaining(before));
    });
  },
);
