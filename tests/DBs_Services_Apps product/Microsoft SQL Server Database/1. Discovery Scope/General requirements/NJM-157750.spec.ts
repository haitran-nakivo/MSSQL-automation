import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-157750: "Verify child databases are discovered for Read-Scale AG (Ref: MSSQL-Inv-General-0005-4)".
// Lab preconditions: the Read-Scale AG target of .env (mssqlReadScaleTarget, 10.10.33.141, AG ReadScaleAG with 3 databases:
//   AdventureWorks2025, DW2025, LT2025 in the lab notes) is reachable and its host is NOT already in Inventory under any name (duplicate = ABORTED);
//   no Inventory item named P02-157750.
// Inventory side effects: adds one item named P02-157750; afterEach removes it (keep transporter) or cancels it if Failed.
// case-vs-ui (step 1): the UI cannot show which databases the source hosts; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 2-3): the Add wizard is opened with Settings > Inventory > + and Application is chosen; the type is set in the Options step.
// case-vs-ui (step 4): there is no instance field: Hostname or IP is the SQL Server hosting the primary replica, plus the clusterless AG name.
// case-vs-ui (step 5): there is no tree to expand: the databases are listed on the item page; an AG holds no system databases, so the three
//   user databases of the AG are expected, not system plus user databases.
// case-vs-ui (step 6): the list is not compared with the databases on the source (no host-side SQL access); the item page shows the 3 databases the lab AG
//   holds (their names are not asserted) and that count is checked against the Inventory row.
test.use(RUN_OPTIONS);

// The lab AG ReadScaleAG holds 3 databases (observed 2026-10-07..09).
const AG_DATABASE_COUNT = 3;
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
  'NAKIVO user sees the databases of an added Microsoft SQL Server Read-Scale availability group listed on its Inventory item',
  { tag: '@NJM-157750' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, addInventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'P02-157750';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
    });

    await test.step('2. Open the Add wizard and choose Application', async () => {
      await flows.startAdd(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Choose Microsoft SQL Server (Read-Scale availability group): the wizard shows the connection fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
    });

    await test.step('4. Enter the host, AG name and credentials and Finish: discovery completes', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the Read-Scale AG did not complete').toBe('discovered');
    });

    await test.step('5. Open the item: the databases of the Read-Scale AG are listed', async () => {
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not list the databases of the Read-Scale AG' })
        .toMatchObject({ type: ITEM_TYPES.readScale, agName: target.agName, totalDatabases: String(AG_DATABASE_COUNT), noIssues: true });
      await expect(inventoryItemPage.text('tempdb')).toHaveCount(0);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157750 step 5: the databases are on the item page, there is no node to expand; the AG holds three user databases and no system databases.' });
    });

    await test.step('6. The number of listed databases agrees with the Inventory row', async () => {
      await flows.gotoInventory();
      const row = await flows.readRow(displayName);
      expect(row.details, 'the Inventory row does not show the same number of databases as the item page').toMatch(new RegExp(`(^|\\s)${AG_DATABASE_COUNT} databases?$`));
      await expect(inventoryPage.item(displayName)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157750 step 6: the databases are not compared with those on the source; the count of 3 on the item page and on the Inventory row is checked.' });
    });
  },
);
