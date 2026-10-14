import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { LAB_ITEMS, listedInInventory } from '../../../../../flows/pkg-P10.flows';

// NJM-159738: "[MSSQL-Inv-UI-Details-cluster-0008] Verify SQL Version Discovery".
// Lab preconditions: the failover cluster instance item FCI-33.140 (host 10.10.33.140) is in Inventory and discovered; it is
//   Inaccessible today (cause unknown), so no version is discovered until the owner repairs it.
// Inventory side effects: none (the item is only read).
// case-vs-ui: Inventory is under Settings > Inventory (not "Configuration"); the item opens as a page, not a "Details panel".
// case-vs-ui: step 2 is not run on the SQL Server (no SQL-side query exists in the project); only the shape of the shown build is checked.
// case-vs-ui: the item page shows a build number (for example 17.0.1000.7), not "2019/2022", and no edition.
test.use(RUN_OPTIONS);

// The version of the lab FCI is not recorded in the lab notes, so only the build-number shape is checked.
const SQL_BUILD = /^\d+\.\d+\.\d+\.\d+$/;

test('NAKIVO Inventory item page of a SQL Server failover cluster instance shows the discovered SQL version', { tag: '@NJM-159738' }, async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage }, testInfo) => {
  test.setTimeout(180_000);
  const name = LAB_ITEMS.failoverCluster;

  await test.step('1. Precondition: the discovered failover cluster instance is listed in Inventory', async () => {
    if (!(await listedInInventory(flows, name))) throw new Error(`ABORTED: the Inventory item "${name}" does not exist; add the failover cluster instance first`);
  });

  await test.step('2. Record the expected SQL version', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The actual product version is not queried on the SQL Server; only the shape of the shown build number is verified.' });
  });

  await test.step('3. Open Settings > Inventory: the page lists the discovered items', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case says Configuration > Inventory; the current UI path is Settings > Inventory.' });
    await flows.gotoInventory();
    await expect(inventoryPage.item(name)).toBeVisible();
  });

  await test.step('4. Select the failover cluster instance item: its item page is shown', async () => {
    await flows.openItem(name);
    await expect(inventoryItemPage.text(ITEM_TYPES.failoverCluster)).toBeVisible();
  });

  await test.step('5. The discovered "SQL version" value is the version running on the source', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI shows a build number such as 17.0.1000.7 (no "2019/2022" and no edition).' });
    await expect(inventoryItemPage.detail('SQL version:')).toHaveText(SQL_BUILD);
  });
});
