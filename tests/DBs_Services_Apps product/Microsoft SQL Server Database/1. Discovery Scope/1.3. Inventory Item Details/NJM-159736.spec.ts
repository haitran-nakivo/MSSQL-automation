import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { LAB_ITEMS, listedInInventory } from '../../../../../flows/pkg-P10.flows';

// NJM-159736: "[MSSQL-Inv-UI-Details-cluster-0006] Verify Instance Name Field Value".
// Lab preconditions: the failover cluster instance item FCI-33.140 (host 10.10.33.140) is in Inventory and discovered (it is Inaccessible
//   today, cause unknown); the fixture mssqlFciTarget (NAKIVO_MSSQL_FCI_INSTANCE_NAME) holds the instance name configured on it.
// Inventory side effects: none (the item is only read).
// case-vs-ui: Inventory is under Settings > Inventory (not "Configuration"); the item opens as a page, not a "Details panel".
// case-vs-ui: step 2 takes the expected name from the fixture (the configured name), not from a query on the SQL Server.
// case-vs-ui: the field is "Instance name:" in the "Instance details" section.
test.use(RUN_OPTIONS);

test('NAKIVO Inventory item page of a SQL Server failover cluster instance shows the configured instance name', { tag: '@NJM-159736' }, async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, mssqlFciTarget: target }, testInfo) => {
  test.setTimeout(180_000);
  const name = LAB_ITEMS.failoverCluster;

  await test.step('1. Precondition: the discovered failover cluster instance is listed in Inventory', async () => {
    if (!(await listedInInventory(flows, name))) throw new Error(`ABORTED: the Inventory item "${name}" does not exist; add the failover cluster instance first`);
  });

  await test.step('2. Record the expected instance name', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The expected instance name is the configured value from the fixture; it is not queried on the source SQL Server.' });
    expect(target.instanceName, 'the fixture holds no instance name').not.toBe('');
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

  await test.step('5. The "Instance name" value equals the expected instance name', async () => {
    await expect(inventoryItemPage.detail('Instance name:')).toHaveText(target.instanceName);
  });
});
