import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-157730: "Verify not support BULK-LOGGED backup on Read-Scale (Ref: MSSQL-Disc-0010-4)".
// Lab preconditions: the Read-Scale availability group target of .env (mssqlReadScaleTarget, host 10.10.33.141, ReadScaleAG) is reachable, has at least one
//   database, and its host is NOT already in Inventory under any name (the Director then answers with the duplicate message and the test ends ABORTED);
//   no Inventory item named DISC-BULK-RSAG. Today 10.10.33.141 is not in Inventory.
// Inventory side effects: adds one item named DISC-BULK-RSAG; afterEach removes it (Remove host and keep transporter; a Failed add is cancelled).
// case-vs-ui (step 1): the expected result is a SQL Server rule (BULK-LOGGED recovery is not allowed in an availability group), not NBR behavior; the UI shows no
//   recovery model and no backup job is created. Only the discovery half is verified: the Read-Scale AG is added, discovery completes, its databases are
//   listed and the item shows No Issues.
test.use(RUN_OPTIONS);

const DATABASE_COUNT = /^[1-9]\d*$/;

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
  'NAKIVO user can discover a Microsoft SQL Server Read-Scale availability group and sees its databases listed with no issues (BULK-LOGGED case: the recovery model itself is not verified)',
  { tag: '@NJM-157730' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, addInventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'DISC-BULK-RSAG';

    await test.step('1. Discover the Read-Scale AG: it is added, its databases are listed and the item has no issues', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      await flows.startAdd(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);

      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the Read-Scale AG did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();

      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered Read-Scale AG databases' })
        .toMatchObject({ agName: target.agName, totalDatabases: expect.stringMatching(DATABASE_COUNT) });
      await expect(inventoryItemPage.noIssues).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157730 step 1: the "SQL Server does not allow the BULK-LOGGED recovery model in an availability group" rule is not verified, no backup job is initiated, and the UI shows no recovery model; only the discovery of the Read-Scale AG is verified.' });
    });
  },
);
