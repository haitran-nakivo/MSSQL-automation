import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-157729: "Verify not support BULK-LOGGED backup on AAG (Ref: MSSQL-Disc-0010-3)".
// Lab preconditions: the Always On availability group target of .env (mssqlAgTarget) is reachable, has at least one database, and its host is NOT already
//   in Inventory under any name (the Director then answers with the duplicate message and the test ends ABORTED); no Inventory item named DISC-BULK-AAG.
//   Today AAG-36.6 (10.10.36.6) is in Inventory and the .env AG variables still point at the old host 10.10.38.76 / AG_TESTDB84: update .env
//   to 10.10.36.6 / AG_TESTDB86 and remove AAG-36.6 from Inventory first.
// Inventory side effects: adds one item named DISC-BULK-AAG; afterEach removes it (Remove host and keep transporter; a Failed add is cancelled).
// case-vs-ui (step 1): the expected result is a SQL Server rule (BULK-LOGGED recovery is not allowed in an availability group), not NBR behavior; the UI shows no
//   recovery model and no backup job is created. Only the discovery half is verified: the AAG is added, discovery completes, its databases are listed
//   and the item shows No Issues. The form asks for the WSFC host (Hostname or IP) and the AG name, not a listener.
test.use(RUN_OPTIONS);

const AAG_TYPE = 'Microsoft SQL Server Always On availability group';
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
  'NAKIVO user can discover a Microsoft SQL Server Always On availability group and sees its databases listed with no issues',
  { tag: '@NJM-157729' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, addInventoryItemPage, mssqlAgTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'DISC-BULK-AAG';

    await test.step('1. Discover the AAG: it is added, its databases are listed and the item has no issues', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      await flows.startAdd();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.typeField).toHaveValue(AAG_TYPE);

      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the availability group did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();

      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered availability group databases' })
        .toMatchObject({ agName: target.agName, totalDatabases: expect.stringMatching(DATABASE_COUNT) });
      await expect(inventoryItemPage.noIssues).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157729 step 1: the "SQL Server does not allow the BULK-LOGGED recovery model in an availability group" rule is not verified, no backup job is initiated, and the UI shows no recovery model; only the discovery of the AAG is verified.' });
    });
  },
);
