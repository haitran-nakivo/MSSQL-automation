import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154507: "[MSSQL-Disc-WF-0018] Verify Backup of BULK-LOGGED Recovery Model".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable, hosts at least one BULK_LOGGED recovery model database
//   (not checkable here; in the lab only 10.10.16.225 has one, and no fixture points to it), and its host is NOT already in Inventory under
//   any name (duplicate = ABORTED); no Inventory item named WF-BKP-BULKLOGGED.
//   Today WS2022-SQL2025-19.145 (the host of mssqlInstanceTarget) is in Inventory: remove it first.
// Inventory side effects: adds one item named WF-BKP-BULKLOGGED (waits for its discovery); afterEach removes it (keep transporter).
// case-vs-ui (steps 1-5): owner decision for recovery-model cases: NBR shows no recovery model, so no backup job is created and no Full,
//   Differential or Log backup is run; the spec checks only that the instance is added, its discovery completes, its databases are listed
//   and the item shows No Issues. The recovery model, the backup runs and the Full/Differential/Log savepoints are not verified.
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
  'NAKIVO Inventory adds a Microsoft SQL Server instance with BULK-LOGGED recovery model databases and lists its databases with No Issues',
  { tag: '@NJM-154507' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_200_000);
    const displayName = 'WF-BKP-BULKLOGGED';

    await test.step('1. Create backup job targeting the BULK-LOGGED model DB: the instance that hosts it is added and its databases are discovered', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
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
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered instance with its databases' })
        .toMatchObject({ type: ITEM_TYPES.instance, instanceName: target.instanceName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154507 steps 1-5: NBR shows no recovery model; no backup job is created and no Full/Differential/Log backup is run. Only add, discovery, listed databases and No Issues are verified.' });
      await testInfo.attach('evidence-1-item-page', { body: await page.screenshot(), contentType: 'image/png' });
    });
  },
);
