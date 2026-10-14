import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-157704: "Verify auto-install of agent on Failover Cluster (Ref: MSSQL-Disc-0001-2)".
// Lab preconditions: the failover cluster instance target of .env (mssqlFciTarget) is reachable and healthy and its host is NOT already in Inventory
//   under any name (the Director then answers with the duplicate message and the test ends ABORTED); no Inventory item named DISC-INSTALL-FCI.
//   Today FCI-33.140 (10.10.33.140) is in Inventory and Inaccessible (cause unknown): repair it and remove the item first. The cluster nodes should
//   have no NAKIVO agent for the case to mean "install"; the test cannot check that.
// Inventory side effects: adds one item named DISC-INSTALL-FCI; afterEach removes it (Remove host and keep transporter; a Failed row is cancelled).
// case-vs-ui (steps 1-2): the UI cannot show that the host answers ping/port or that no NAKIVO agent service exists on the nodes; only a signed-in Director is checked.
// case-vs-ui (steps 3-4): Application is chosen in the Add Inventory Item wizard (Settings > Inventory > +), then the Type combo is set to the failover
//   cluster instance type; the form has Hostname or IP (the WSFC) and Instance name as separate fields.
// case-vs-ui (steps 5-6): NBR shows no "deploying the agent" message; the wizard closes and the row shows Adding... until the database count appears.
// case-vs-ui (step 6): the installed and started agent service on each node is not observable in the UI and is not asserted.
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
  'NAKIVO user can add a Microsoft SQL Server failover cluster instance and its databases are discovered',
  { tag: '@NJM-157704' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlFciTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'DISC-INSTALL-FCI';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
    });

    await test.step('2. No NAKIVO agent is on the cluster nodes before discovery', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157704 step 2: the Windows services of the nodes are not observable in the UI; the absence of the agent is not checked.' });
    });

    await test.step('3. Open the Add wizard and choose Application', async () => {
      // startAdd opens the wizard, chooses Application, goes to the Options step and sets the Type (case steps 3 and 4 are one UI action).
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('4. Choose Microsoft SQL Server (failover cluster instance): the form shows the host and credential fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('5. Enter the cluster host and valid credentials and finish: discovery starts', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157704 step 5: NBR shows no "deploying the agent" message; the row appears with Adding... after the wizard closes.' });
    });

    await test.step('6. Wait for the discovery to complete', async () => {
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the failover cluster instance did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157704 step 6: the automatic installation and start of the agent service on each node is not observable in the UI; only the completed discovery is asserted.' });
    });

    await test.step('7. The failover cluster instance is in Inventory and its databases are discovered and listed', async () => {
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered failover cluster instance' })
        .toMatchObject({ type: ITEM_TYPES.failoverCluster, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
    });
  },
);
