import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ALWAYS_ON_TYPE, LAB_ITEMS, listedInInventory } from '../../../../../flows/pkg-P10.flows';

// NJM-159742: "[MSSQL-Inv-UI-AO-0007] Verify SQL Version Field Presence".
// Lab preconditions: the Always On AG item AAG-36.6 (host 10.10.36.6, single replica) is in Inventory and discovered.
// Inventory side effects: none (the item is only read).
// case-vs-ui: Inventory is under Settings > Inventory (not "Configuration"); the item opens as a page, not a "Details panel".
// case-vs-ui: the label is "SQL version:" and sits in the "Instance details" section, not in "General Information".
// case-vs-ui: the lab AG has a single replica (the case precondition says two or more); the field does not depend on it.
test.use(RUN_OPTIONS);

test('NAKIVO Inventory item page of an Always On availability group shows the SQL version field', { tag: '@NJM-159742' }, async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage }, testInfo) => {
  test.setTimeout(180_000);
  const name = LAB_ITEMS.alwaysOn;

  await test.step('1. Precondition: the discovered Always On availability group is listed in Inventory', async () => {
    if (!(await listedInInventory(flows, name))) throw new Error(`ABORTED: the Inventory item "${name}" does not exist; add the Always On availability group first`);
  });

  await test.step('2. Open Settings > Inventory: the page lists the discovered items', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case says Configuration > Inventory; the current UI path is Settings > Inventory.' });
    await flows.gotoInventory();
    await expect(inventoryPage.item(name)).toBeVisible();
  });

  await test.step('3. Select the availability group item: its item page is shown', async () => {
    await flows.openItem(name);
    await expect(inventoryItemPage.text(ALWAYS_ON_TYPE)).toBeVisible();
  });

  await test.step('4. The General information section is visible', async () => {
    await expect(inventoryItemPage.text('General information')).toBeVisible();
  });

  await test.step('5. The "SQL version" field label is displayed', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The label is "SQL version:" in the "Instance details" section, not "SQL Version" in General Information.' });
    await expect(inventoryItemPage.text('Instance details')).toBeVisible();
    await expect(inventoryItemPage.text('SQL version:')).toBeVisible();
  });
});
