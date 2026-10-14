import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { ObsCFlows } from '../../../../../flows/pkg-obsC.flows';
import { SqlHost } from '../../../../../helpers/sql-host';

// NJM-154512: "[MSSQL-Disc-WF-0027] Verify Database Identity Logic" (2 of 3 attributes: Name, ID, State).
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget, host 10.10.19.145) is reachable from this PC on the SQL port with the SQL login
//   from .env, that login may CREATE, rename and DROP databases, and the host is NOT already in Inventory under any name (duplicate = ABORTED); no item named
//   P02-154512; no database named qa_ident_154512 or qa_ident_154512b on the instance. Today WS2022-SQL2025-19.145 is in Inventory: remove it first.
// Inventory side effects: adds one item named P02-154512 and refreshes it; afterEach drops the databases created by this test and removes the item (keep
//   transporter, or cancel when Failed). Source side effect: one database is created, renamed and dropped on the instance.
// case-vs-ui (step 1): the test creates its own disposable database before it adds the instance, so the database is discovered under the instance.
// case-vs-ui (step 2): the rename is sent from this PC with the SQL login (no WinRM at run time); Database_ID and State are read back from the source.
// case-vs-ui (step 4): NBR does not show how it resolved identity; the same-database result is judged from the Inventory (old name gone, new name present,
//   the count of databases unchanged).
// case-vs-ui (step 5): "backup history is preserved" is not verified: no backup is taken here (it needs a backup job and repository).
test.use(RUN_OPTIONS);

const displayName = 'P02-154512';
const oldName = 'qa_ident_154512';
const newName = 'qa_ident_154512b';

const created = new Set<string>();
let sql: SqlHost | undefined;

test.afterEach(async ({ inventoryFlows }) => {
  if (sql) {
    for (const database of [oldName, newName]) {
      try {
        await sql.dropDatabaseIfExists(database);
      } catch {
        // Best effort: the original failure is what the report shows.
      }
    }
  }
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
  'NAKIVO Inventory keeps one entry for a database that was renamed on the SQL Server instance and shows its new name after the item is refreshed',
  { tag: '@NJM-154512' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_800_000);
    const more = new ObsCFlows(page, flows);
    let identityBefore = { name: '', id: '', state: '' };
    let before: string[] = [];

    await test.step('1. Precondition: the instance with the target database is discovered in the Inventory', async () => {
      sql = new SqlHost(target.host, target.instanceName, target.sqlUsername, target.sqlPassword);
      for (const database of [oldName, newName]) {
        if (await sql.identity(database)) throw new Error(`ABORTED: a database named ${database} already exists on ${target.host}; drop it and run again`);
      }
      await sql.createDatabase(oldName);
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
      expect(before, 'the new database is not listed under the instance').toContain(oldName);
      const found = await sql.identity(oldName);
      expect(found).toBeDefined();
      identityBefore = found as { name: string; id: string; state: string };
    });

    await test.step('2. On the instance rename the database: the name changes, Database_ID and State stay the same', async () => {
      await (sql as SqlHost).renameDatabase(oldName, newName);
      const renamed = await (sql as SqlHost).identity(newName);
      expect(renamed, 'the renamed database is not on the source').toBeDefined();
      expect(renamed?.id).toBe(identityBefore.id);
      expect(renamed?.state).toBe(identityBefore.state);
      expect(await (sql as SqlHost).identity(oldName)).toBeUndefined();
    });

    await test.step('3. In Director refresh the instance: the refresh starts', async () => {
      await flows.gotoInventory();
      await flows.openItem(displayName);
      await more.clickRefresh();
    });

    await test.step('4. The product resolves the database as the same one: no second entry appears', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154512 step 4: NBR does not show the identity decision; it is judged from the Inventory list.' });
      await expect
        .poll(() => more.reopenAndReadDatabases(displayName), { timeout: 300_000, intervals: [10_000], message: 'the item page did not list the renamed database after Refresh' })
        .toContain(newName);
    });

    await test.step('5. The existing entry carries the new name and no duplicate exists', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154512 step 5: the preservation of the backup history is not verified (no backup is taken).' });
      const after = await more.databaseNamesOnPage();
      expect(after).toContain(newName);
      expect(after, 'the old database name is still listed').not.toContain(oldName);
      expect(after.length, 'the number of listed databases changed (a duplicate entry was created)').toBe(before.length);
    });
  },
);
