import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-157719: "Support SIMPLE recovery backup on Instance (Ref: MSSQL-Disc-0008-1)".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable, holds at least one database in the SIMPLE recovery
//   model, and its host is NOT already in Inventory under any name (the Director then answers with the duplicate message and the test ends ABORTED);
//   no Inventory item named DISC-SIMPLE-INSTANCE. Today WS2022-SQL2025-19.145 is in Inventory: remove it first. The recovery models of its databases
//   are not known to this test (WS2022-SQL2022-16.176 has only SIMPLE databases but has no fixture).
// Inventory side effects: adds one item named DISC-SIMPLE-INSTANCE; afterEach removes it (Remove host and keep transporter; a Failed row is cancelled).
// case-vs-ui (step 1): the UI cannot show that the host is online or any recovery model; only a signed-in Director is checked.
// case-vs-ui (steps 3-5): Application is chosen in the Add Inventory Item wizard (Settings > Inventory > +), then the Type combo is set to the instance
//   type; one UI action covers the Add New, Application and Microsoft SQL Server steps, and the form has Hostname or IP and Instance name as separate fields.
// case-vs-ui (step 7): NBR shows no recovery model; the item page lists databases without it. Only that databases are discovered is asserted.
// case-vs-ui (step 8): the item is added by Finish in the wizard (there is no separate save of a discovered instance); the item page shows No Issues.
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
  'NAKIVO user can add a standalone Microsoft SQL Server instance, its databases are discovered and the item shows no issues',
  { tag: '@NJM-157719' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'DISC-SIMPLE-INSTANCE';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157719 step 1: the SIMPLE recovery model of a database is not shown by NBR and is not checked; the host being online is shown only by the add that follows.' });
    });

    await test.step('2. Open the Inventory: the page is displayed', async () => {
      await flows.gotoInventory();
      await expect(page.locator('.add-btn').filter({ visible: true })).toBeVisible();
    });

    await test.step('3. Click Add New: the Add wizard opens', async () => {
      // startAdd opens the wizard, chooses Application, goes to the Options step and sets the Type (case steps 3-5 are one UI action).
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('4. Select Application', async () => {
      // Done by startAdd in step 3; the Options step with the Type field being shown proves the Application choice was accepted.
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('5. Select Microsoft SQL Server (instance): the form shows the host and credential fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('6. Enter the instance host and administrative credentials and finish: discovery completes without error', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the instance did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
    });

    await test.step('7. The databases of the instance are discovered and listed', async () => {
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show discovered databases' })
        .toMatchObject({ type: ITEM_TYPES.instance, totalDatabases: expect.stringMatching(/^[1-9]\d*$/) });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157719 step 7: the case expects the SIMPLE database to be listed with its recovery model; NBR shows no recovery model and the database name is not given, so only the discovered database count is asserted.' });
    });

    await test.step('8. The instance is in Inventory with no alarms', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show No Issues' })
        .toMatchObject({ noIssues: true });
    });
  },
);
