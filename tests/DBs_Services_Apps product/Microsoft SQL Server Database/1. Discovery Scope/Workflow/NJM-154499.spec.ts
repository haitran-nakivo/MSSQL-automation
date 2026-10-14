import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154499: "[MSSQL-Disc-WF-0009] Verify Standalone Instance Metadata Discovery".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in Inventory under
//   any name (the Director then answers with the duplicate message and the test ends ABORTED); no Inventory item named WF-META-INSTANCE.
//   Today WS2022-SQL2025-19.145 (the host of mssqlInstanceTarget) is in Inventory: remove it first.
// Inventory side effects: adds one item named WF-META-INSTANCE (waits for its discovery); afterEach removes it (keep transporter).
// case-vs-ui (step 1): the UI cannot show that the host is reachable; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (step 3): the item page shows Display name (the host value), Type, Operating system, Instance name, Total databases and SQL version;
//   it has no separate host name and IP address, so only the type, OS, instance name and SQL version are checked (populated / correct instance name).
// case-vs-ui (step 4): the database names, the sizes and the file paths cannot be compared with the host; the spec checks that databases are
//   listed (Total databases and the row's database count). Case steps 5 and 6 (database size, .mdf/.ldf paths) are not performed: NBR 11.2.1 shows neither.
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
  'NAKIVO Inventory shows the type, operating system, instance name, SQL version and databases of a discovered standalone SQL Server instance',
  { tag: '@NJM-154499' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_200_000);
    const displayName = 'WF-META-INSTANCE';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154499 step 1: the UI cannot show that the SQL host is reachable; only a signed-in Director and the Inventory page are checked.' });
    });

    await test.step('2. Add the standalone instance (Application > Microsoft SQL Server) and run discovery', async () => {
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the instance did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
      await expect(inventoryPage.item(displayName)).toBeVisible();
    });

    await test.step('3. Open the discovered instance: the type, operating system, instance name and SQL version are populated', async () => {
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the populated instance metadata' })
        .toMatchObject({ type: ITEM_TYPES.instance, os: expect.stringMatching(/Windows/), instanceName: target.instanceName, sqlVersion: expect.stringMatching(/^\d+\.\d+/), noIssues: true });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154499 step 3: the item page has one host value (the Display name) and no separate IP address; host name and IP address are not checked. The OS is checked to be a Windows version.' });
      await testInfo.attach('evidence-3-item-page', { body: await page.screenshot(), contentType: 'image/png' });
    });

    await test.step('4. The databases of the instance are listed', async () => {
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not list the databases of the instance' })
        .toMatchObject({ totalDatabases: expect.stringMatching(/^[1-9]\d*$/) });
      await flows.gotoInventory();
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154499 steps 4-6: NBR shows a database count, but not the names compared with the host, the sizes, or the .mdf/.ldf paths; only "databases are listed" is verified and steps 5-6 are not performed.' });
    });
  },
);
