import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154496: "[MSSQL-Disc-WF-0002] Verify Auto-Install Transporter on Cluster Node".
// Lab preconditions: the failover cluster target of .env (mssqlFciTarget, FCI-33.140) is online with both nodes up and its host is NOT already
//   in Inventory under any name (duplicate = ABORTED); no Inventory item named WF-FCI-AUTOINSTALL.
//   Today FCI-33.140 is in Inventory and Inaccessible: it must be removed and the cluster repaired before this test can pass.
// Inventory side effects: adds one item named WF-FCI-AUTOINSTALL (waits for its discovery); afterEach removes it (keep transporter).
// case-vs-ui (step 1): the UI cannot show that the nodes are Online or that no Transporter is installed on them; only a signed-in Director
//   and the Inventory page are checked.
// case-vs-ui (steps 2-3): one Add wizard (Settings > Inventory > + > Application, Type = failover cluster instance) covers entering the
//   cluster host and credentials and starting discovery with Finish; the wizard has no Transporter step, so "no manual Transporter step"
//   is checked as: the wizard closes at Finish with no extra prompt.
// case-vs-ui (steps 5-7): the Windows service state on the nodes, the failover to a passive node and the refresh after it are not observable
//   by this spec; they are not performed. The spec checks that the item is added, discovered, not Failed or Inaccessible and has No Issues.
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
  'NAKIVO Add wizard adds and discovers a Microsoft SQL Server failover cluster instance without a manual Transporter step and shows it accessible',
  { tag: '@NJM-154496' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, wizardFlows, inventoryPage, addInventoryItemPage, mssqlFciTarget: target }, testInfo) => {
    test.setTimeout(1_200_000);
    const displayName = 'WF-FCI-AUTOINSTALL';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154496 step 1: the UI cannot show that the cluster nodes are Online or that no Transporter is installed on them; only a signed-in Director and the Inventory page are checked.' });
    });

    await test.step('2. Open the Add wizard (Application > Microsoft SQL Server, failover cluster instance) and enter the cluster host and credentials', async () => {
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      await flows.fillAddForm({ displayName, ...target });
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
      await expect.poll(async () => (await wizardFlows.fieldState('username', 1)).value, { message: 'SQL username does not hold the typed value' }).toBe(target.sqlUsername);
    });

    await test.step('3. Start discovery with Finish: it proceeds without a manual Transporter step', async () => {
      const outcome = await flows.finishAdd();
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154496 step 3: the Transporter installation on the cluster nodes is not visible in the UI; only the absence of a manual Transporter step (the wizard closes at Finish) is verified.' });
    });

    await test.step('4. Wait for discovery: the failover cluster instance is added to Inventory and shown as accessible', async () => {
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the failover cluster instance did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
      await expect(inventoryPage.row(displayName).getByText('Inaccessible', { exact: true })).toBeHidden();
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show an accessible failover cluster instance' })
        .toMatchObject({ type: ITEM_TYPES.failoverCluster, instanceName: target.instanceName, noIssues: true });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154496 steps 5-7: the Transporter service on the active and passive nodes, the failover to a passive node and the refresh after it are not performed (not observable in the UI); not verified.' });
      await testInfo.attach('evidence-4-item-page', { body: await page.screenshot(), contentType: 'image/png' });
    });
  },
);
