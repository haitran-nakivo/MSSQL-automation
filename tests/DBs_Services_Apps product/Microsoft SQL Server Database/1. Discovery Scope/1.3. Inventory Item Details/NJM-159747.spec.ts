import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { LAB_ITEMS, addReadScaleItem, listedInInventory } from '../../../../../flows/pkg-P10.flows';

// NJM-159747: "[MSSQL-Inv-UI-Details-RS-0008] Verify SQL Version Discovery".
// Lab preconditions: the Read-Scale AG host 10.10.33.141 (SQL Server 2025, build 17.0.1000.7; the fixture mssqlReadScaleTarget) is
//   reachable; the item RSAG-33.141 is in Inventory, or the test adds it (the host must not be in Inventory under another name, else ABORTED).
// Inventory side effects: none when RSAG-33.141 exists; otherwise the test adds RSAG-33.141 and removes it again (keep transporter).
// case-vs-ui: Inventory is under Settings > Inventory (not "Configuration"); the item opens as a page, not a "Details panel".
// case-vs-ui: step 2 is not run on the SQL Server (no SQL-side query exists in the project); the check is the shape and major version of the shown build.
// case-vs-ui: the item page shows a build number (17.0.1000.7), not "2019/2022", and no edition.
test.use(RUN_OPTIONS);

// The lab host runs SQL Server 2025, which reports build 17.x.
const SQL_2025_BUILD = /^17\.\d+\.\d+\.\d+$/;

// Names this test created (only these are ever removed).
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

test('NAKIVO Inventory item page of a Read-Scale availability group shows the discovered SQL version', { tag: '@NJM-159747' }, async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
  test.setTimeout(1_500_000);
  const name = LAB_ITEMS.readScale;

  await test.step('1. Precondition: the discovered Read-Scale availability group is listed in Inventory', async () => {
    if (await listedInInventory(flows, name)) return;
    created.add(name);
    const outcome = await addReadScaleItem(flows, { displayName: name, ...target });
    if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
    expect(outcome, `adding the Read-Scale AG "${name}" did not complete discovery`).toBe('added');
  });

  await test.step('2. Record the expected SQL version', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The actual product version is not queried on the SQL Server; the lab host is known to run SQL Server 2025 (build 17.x) and the shown build is checked against that major version.' });
  });

  await test.step('3. Open Settings > Inventory: the page lists the discovered items', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case says Configuration > Inventory; the current UI path is Settings > Inventory.' });
    await flows.gotoInventory();
    await expect(inventoryPage.item(name)).toBeVisible();
  });

  await test.step('4. Select the Read-Scale availability group item: its item page is shown', async () => {
    await flows.openItem(name);
    await expect(inventoryItemPage.text(ITEM_TYPES.readScale)).toBeVisible();
  });

  await test.step('5. The discovered "SQL version" value is the version running on the source', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI shows a build number such as 17.0.1000.7 (no "2019/2022" and no edition).' });
    await expect(inventoryItemPage.detail('SQL version:')).toHaveText(SQL_2025_BUILD);
  });
});
