import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { LAB_ITEMS, addReadScaleItem, listedInInventory } from '../../../../../flows/pkg-P10.flows';

// NJM-154658: "[MSSQL-Inv-UI-Details-RS-0004] Verify AG Details Widget (Read-Scale)".
// Lab preconditions: the Read-Scale AG host 10.10.33.141 (AG ReadScaleAG) is reachable; the item RSAG-33.141 is in Inventory, or the test
//   adds it (the host must not be in Inventory under another name, else ABORTED).
// Inventory side effects: none when RSAG-33.141 exists; otherwise the test adds RSAG-33.141 and removes it again (keep transporter).
// case-vs-ui: Inventory is under Settings > Inventory (not "Configuration"); the item opens as a page, not a "Details panel".
// case-vs-ui: there is no "AG Details widget" in a summary bar: the item page has an "Instance details" section with AG name, Total databases and SQL version.
// case-vs-ui: replica names, roles and replica counts are not shown in the UI, so they are not verified.
test.use(RUN_OPTIONS);

const DATABASE_COUNT = /^[1-9]\d*$/;

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

test('NAKIVO Inventory item page of a Read-Scale availability group shows its AG name, databases and SQL version in Instance details', { tag: '@NJM-154658' }, async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
  test.setTimeout(1_500_000);
  const name = LAB_ITEMS.readScale;

  await test.step('1. Precondition: the discovered Read-Scale availability group is listed in Inventory', async () => {
    if (await listedInInventory(flows, name)) return;
    created.add(name);
    const outcome = await addReadScaleItem(flows, { displayName: name, ...target });
    if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
    expect(outcome, `adding the Read-Scale AG "${name}" did not complete discovery`).toBe('added');
  });

  await test.step('2. Open Settings > Inventory: the page lists the discovered items', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case says Configuration > Inventory; the current UI path is Settings > Inventory.' });
    await flows.gotoInventory();
    await expect(inventoryPage.item(name)).toBeVisible();
  });

  await test.step('3. Select the Read-Scale availability group item: its item page is shown', async () => {
    await flows.openItem(name);
    await expect(inventoryItemPage.text(ITEM_TYPES.readScale)).toBeVisible();
  });

  await test.step('4. Locate the details of the Read-Scale availability group', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'There is no "AG Details widget" in a summary bar; the current UI shows an "Instance details" section on the item page.' });
    await expect(inventoryItemPage.text('Instance details')).toBeVisible();
  });

  await test.step('5. The details show the AG name and the database count of the Read-Scale availability group', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Replicas and their roles (primary/secondary) and replica counts are not shown in the current UI; only AG name, Total databases and SQL version are verified.' });
    await expect
      .poll(() => flows.readItemDetails(), { message: 'the item page does not show the Read-Scale AG details' })
      .toMatchObject({ type: ITEM_TYPES.readScale, agName: target.agName, totalDatabases: expect.stringMatching(DATABASE_COUNT) });
  });
});
