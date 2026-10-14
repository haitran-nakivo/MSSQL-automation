import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154500: "[MSSQL-Disc-WF-0010] Verify Failover Cluster Metadata Discovery".
// Lab preconditions: the failover cluster target of .env (mssqlFciTarget, FCI-33.140) is online with both nodes up and its host is NOT already
//   in Inventory under any name (duplicate = ABORTED); no Inventory item named WF-META-FCI.
//   Today FCI-33.140 is in Inventory and Inaccessible: it must be removed and the cluster repaired before this test can pass.
// Inventory side effects: adds one item named WF-META-FCI (waits for its discovery); afterEach removes it (keep transporter).
// case-vs-ui (step 1): the UI cannot show that the cluster is reachable; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (step 2): the Add wizard is Settings > Inventory > + > Application, Type = failover cluster instance; "cluster VIP" is the
//   Hostname or IP field (the WSFC hosting the FCI) and the form also has Instance name.
// case-vs-ui (steps 3-6): NBR 11.2.1 does not show the participating nodes, the active node and its IP, the shared-disk paths or an
//   IsClustered flag; they are not verified. The spec checks that the item is added, discovered, typed as a failover cluster instance and has No Issues.
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
  'NAKIVO Inventory adds and discovers a Microsoft SQL Server failover cluster instance and identifies it as a failover cluster instance',
  { tag: '@NJM-154500' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlFciTarget: target }, testInfo) => {
    test.setTimeout(1_200_000);
    const displayName = 'WF-META-FCI';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154500 step 1: the UI cannot show that the cluster or its nodes are reachable; only a signed-in Director and the Inventory page are checked.' });
    });

    await test.step('2. Add the failover cluster instance (Application > Microsoft SQL Server) and run discovery', async () => {
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the failover cluster instance did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
      await expect(inventoryPage.item(displayName)).toBeVisible();
    });

    await test.step('3. Open the cluster instance item: it is identified as a failover cluster instance', async () => {
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered failover cluster instance' })
        .toMatchObject({ type: ITEM_TYPES.failoverCluster, instanceName: target.instanceName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154500 steps 3-6: the participating nodes, the active node and its IP, the shared-disk data/log paths and the IsClustered flag are not shown by NBR 11.2.1; the item type (failover cluster instance) is verified instead.' });
      await testInfo.attach('evidence-3-item-page', { body: await page.screenshot(), contentType: 'image/png' });
    });
  },
);
