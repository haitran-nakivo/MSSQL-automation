import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154502: "[MSSQL-Disc-WF-0012] Verify Read-Scale AG Metadata Discovery".
// Lab preconditions: the Read-Scale AG target of .env (mssqlReadScaleTarget: host 10.10.33.141, AG ReadScaleAG) is reachable and its host is
//   NOT already in Inventory under any name (duplicate = ABORTED); no Inventory item named WF-META-RSAG.
// Inventory side effects: adds one item named WF-META-RSAG (waits for its discovery); afterEach removes it (keep transporter).
// case-vs-ui (step 1): the UI cannot show that the primary replica is reachable; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (step 2): the Add wizard is Settings > Inventory > + > Application, Type = Read-Scale availability group; the address is the
//   Hostname or IP of the SQL Server hosting the primary replica, and the form also has the AG name.
// case-vs-ui (steps 4-5): NBR 11.2.1 does not show the replicas, their roles or a clustering flag; they are not performed. Case step 6 is
//   checked as: the AG name and a database count are shown (the database names are not compared with the host).
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
  'NAKIVO Inventory identifies a discovered Microsoft SQL Server Read-Scale availability group by its type and AG name and lists its databases',
  { tag: '@NJM-154502' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_200_000);
    const displayName = 'WF-META-RSAG';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154502 step 1: the UI cannot show that the primary replica is reachable; only a signed-in Director and the Inventory page are checked.' });
    });

    await test.step('2. Add the Read-Scale AG by its primary replica address (Application > Microsoft SQL Server) and run discovery', async () => {
      await flows.startAdd(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the Read-Scale AG did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
      await expect(inventoryPage.item(displayName)).toBeVisible();
    });

    await test.step('3. Open the discovered AG object: it is a Read-Scale availability group', async () => {
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show a Read-Scale availability group' })
        .toMatchObject({ type: ITEM_TYPES.readScale, agName: target.agName, sqlVersion: expect.stringMatching(/^\d+\.\d+/), noIssues: true });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154502 steps 4-5: NBR 11.2.1 shows no replica list, replica roles or clustering flag (IsClustered); they are not verified. The item type "Microsoft SQL Server Read-Scale availability group" is verified instead.' });
      await testInfo.attach('evidence-3-item-page', { body: await page.screenshot(), contentType: 'image/png' });
    });

    await test.step('6. The databases of the Read-Scale AG are listed', async () => {
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not list the databases of the Read-Scale AG' })
        .toMatchObject({ totalDatabases: expect.stringMatching(/^[1-9]\d*$/) });
      await flows.gotoInventory();
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154502 step 6: the database count is verified; the database names are not compared with the names on the host.' });
    });
  },
);
