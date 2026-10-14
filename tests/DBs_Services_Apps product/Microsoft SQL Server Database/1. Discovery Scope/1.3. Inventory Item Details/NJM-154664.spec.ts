import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { LAB_ITEMS, listedInInventory } from '../../../../../flows/pkg-P10.flows';

// NJM-154664: "[MSSQL-Inv-UI-Details-instance-0008] Verify SQL Version Discovery".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 (host 10.10.19.145, SQL Server 2025) is in Inventory and discovered.
// Inventory side effects: none (the item is only read).
// case-vs-ui: Inventory is under Settings > Inventory (not "Configuration"); the item opens as a page, not a "Details panel".
// case-vs-ui: step 2 is not run on the SQL Server (no SQL-side query exists in the project); the check is the shape and major version of the shown build.
// case-vs-ui: the item page shows a build number (for example 17.0.1000.7), not "2019/2022", and no edition.
test.use(RUN_OPTIONS);

// The lab host runs SQL Server 2025, which reports build 17.x.
const SQL_2025_BUILD = /^17\.\d+\.\d+\.\d+$/;

test('NAKIVO Inventory item page of a standalone SQL Server instance shows the discovered SQL version', { tag: '@NJM-154664' }, async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage }, testInfo) => {
  test.setTimeout(180_000);
  const name = LAB_ITEMS.instance;

  await test.step('1. Precondition: the discovered standalone instance is listed in Inventory', async () => {
    if (!(await listedInInventory(flows, name))) throw new Error(`ABORTED: the Inventory item "${name}" does not exist; add the standalone instance first`);
  });

  await test.step('2. Record the expected SQL version', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The actual product version is not queried on the SQL Server; the lab host is known to run SQL Server 2025 (build 17.x) and the shown build is checked against that major version.' });
  });

  await test.step('3. Open Settings > Inventory: the page lists the discovered items', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case says Configuration > Inventory; the current UI path is Settings > Inventory.' });
    await flows.gotoInventory();
    await expect(inventoryPage.item(name)).toBeVisible();
  });

  await test.step('4. Select the instance item: its item page is shown', async () => {
    await flows.openItem(name);
    await expect(inventoryItemPage.text(ITEM_TYPES.instance)).toBeVisible();
  });

  await test.step('5. The discovered "SQL version" value is the version running on the source', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI shows a build number such as 17.0.1000.7 (no "2019/2022" and no edition).' });
    await expect(inventoryItemPage.detail('SQL version:')).toHaveText(SQL_2025_BUILD);
  });
});
