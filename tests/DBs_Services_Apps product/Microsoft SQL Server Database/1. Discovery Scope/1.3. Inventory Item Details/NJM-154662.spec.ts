import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ALWAYS_ON_TYPE, LAB_ITEMS, listedInInventory } from '../../../../../flows/pkg-P10.flows';

// NJM-154662: "[MSSQL-Inv-UI-Details-0016-1] Verify AG Name Field Value".
// Lab preconditions: the Always On AG item AAG-36.6 (host 10.10.36.6) is in Inventory and discovered; the fixture mssqlAgTarget
//   (NAKIVO_MSSQL_AG_NAME) must hold its AG name AG_TESTDB86 (the .env still points at the old AG AG_TESTDB84 until the owner updates it).
// Inventory side effects: none (the item is only read).
// case-vs-ui: Inventory is under Settings > Inventory (not "Configuration"); the item opens as a page, not a "Details panel".
// case-vs-ui: step 2 takes the expected name from the fixture (the configured name), not from a query on the SQL Server.
// case-vs-ui: the field is "AG name:" in the "Instance details" section; the lab AG has a single replica (the case says two or more).
test.use(RUN_OPTIONS);

test('NAKIVO Inventory item page of an Always On availability group shows the configured AG name', { tag: '@NJM-154662' }, async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, mssqlAgTarget: target }, testInfo) => {
  test.setTimeout(180_000);
  const name = LAB_ITEMS.alwaysOn;

  await test.step('1. Precondition: the discovered Always On availability group is listed in Inventory', async () => {
    if (!(await listedInInventory(flows, name))) throw new Error(`ABORTED: the Inventory item "${name}" does not exist; add the Always On availability group first`);
  });

  await test.step('2. Record the expected AG name', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The expected AG name is the configured value from the fixture; it is not queried on the source SQL Server.' });
    expect(target.agName, 'the fixture holds no AG name').not.toBe('');
  });

  await test.step('3. Open Settings > Inventory: the page lists the discovered items', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case says Configuration > Inventory; the current UI path is Settings > Inventory.' });
    await flows.gotoInventory();
    await expect(inventoryPage.item(name)).toBeVisible();
  });

  await test.step('4. Select the availability group item: its item page is shown', async () => {
    await flows.openItem(name);
    await expect(inventoryItemPage.text(ALWAYS_ON_TYPE)).toBeVisible();
  });

  await test.step('5. The AG name value equals the expected AG name', async () => {
    await expect(inventoryItemPage.detail('AG name:')).toHaveText(target.agName);
  });
});
