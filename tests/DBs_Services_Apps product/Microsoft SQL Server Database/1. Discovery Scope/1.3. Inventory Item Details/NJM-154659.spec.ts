import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { LAB_ITEMS, listedInInventory } from '../../../../../flows/pkg-P10.flows';

// NJM-154659: "[MSSQL-Inv-UI-Details-instance-0005] Verify Instance Name Field Presence".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 (host 10.10.19.145) is in Inventory and discovered.
// Inventory side effects: none (the item is only read).
// case-vs-ui: Inventory is under Settings > Inventory (not "Configuration"); the item opens as a page, not a "Details panel".
// case-vs-ui: the label is "Instance name:" and sits in the "Instance details" section, not in "General Information".
test.use(RUN_OPTIONS);

test('NAKIVO Inventory item page of a standalone SQL Server instance shows the Instance name field', { tag: '@NJM-154659' }, async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage }, testInfo) => {
  test.setTimeout(180_000);
  const name = LAB_ITEMS.instance;

  await test.step('1. Precondition: the discovered standalone instance is listed in Inventory', async () => {
    if (!(await listedInInventory(flows, name))) throw new Error(`ABORTED: the Inventory item "${name}" does not exist; add the standalone instance first`);
  });

  await test.step('2. Open Settings > Inventory: the page lists the discovered items', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case says Configuration > Inventory; the current UI path is Settings > Inventory.' });
    await flows.gotoInventory();
    await expect(inventoryPage.item(name)).toBeVisible();
  });

  await test.step('3. Select the instance item: its item page is shown', async () => {
    await flows.openItem(name);
    await expect(inventoryItemPage.text(ITEM_TYPES.instance)).toBeVisible();
  });

  await test.step('4. The General information section is visible', async () => {
    await expect(inventoryItemPage.text('General information')).toBeVisible();
  });

  await test.step('5. The "Instance name" field label is displayed', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The label is "Instance name:" in the "Instance details" section, not "Instance Name" in General Information.' });
    await expect(inventoryItemPage.text('Instance details')).toBeVisible();
    await expect(inventoryItemPage.text('Instance name:')).toBeVisible();
  });
});
