import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154497: "[MSSQL-Disc-WF-0006] Verify Discovery via UI".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in Inventory under
//   any name (the Director then answers with the duplicate message and the test ends ABORTED); no Inventory item named WF-DISC-UI-INSTANCE.
//   Today WS2022-SQL2025-19.145 (the host of mssqlInstanceTarget) is in Inventory: remove it first.
// Inventory side effects: adds one item named WF-DISC-UI-INSTANCE (waits for its discovery); afterEach removes it (keep transporter).
// case-vs-ui (step 1): the UI cannot show that the host answers on the network; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 2-3): the Add wizard is opened with Settings > Inventory > + and Application is chosen, then the Type combo is set to the
//   instance type; one UI action covers both case steps (the call is in step 2, step 3 asserts the wizard it opened).
// case-vs-ui (step 5): the wizard closes at Finish; "no error reported in the wizard" is checked as: the wizard closed and the row does not end as Failed.
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
  'NAKIVO user can discover a standalone Microsoft SQL Server instance through the Add wizard and see its databases in Inventory',
  { tag: '@NJM-154497' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_200_000);
    const displayName = 'WF-DISC-UI-INSTANCE';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154497 step 1: the UI cannot show that the SQL host is reachable; only a signed-in Director and the Inventory page are checked.' });
    });

    await test.step('2. Open the Add wizard (Settings > Inventory > +) and choose Application > Microsoft SQL Server (instance)', async () => {
      // startAdd opens the wizard, chooses Application, goes to the Options step and sets the Type (case steps 2 and 3 are one UI action).
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.title).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154497 steps 2-3: the wizard is opened with Settings > Inventory > + and Application is chosen on its first page; there is no Add New item type selector.' });
    });

    await test.step('3. The Microsoft SQL Server discovery wizard is open', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
    });

    await test.step('4. Enter the SQL host and valid credentials and start discovery with Finish', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
    });

    await test.step('5. Wait for the discovery to complete: no error', async () => {
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the instance did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154497 step 5: no error is shown in the wizard because it closes at Finish; the absence of an error is checked as a row that shows its databases and no Failed badge.' });
    });

    await test.step('6. The discovered instance appears in Inventory with its databases listed', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered instance' })
        .toMatchObject({ type: ITEM_TYPES.instance, instanceName: target.instanceName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
      await testInfo.attach('evidence-6-item-page', { body: await page.screenshot(), contentType: 'image/png' });
    });
  },
);
