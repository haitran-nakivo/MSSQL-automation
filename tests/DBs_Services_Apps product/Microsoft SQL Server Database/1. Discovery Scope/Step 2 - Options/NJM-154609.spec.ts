import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154609: "[MSSQL-Inv-UI-Options-0023-6-7-1-TC02] Verify Password Edit State (Not Loaded)".
// Lab preconditions: signed-in Director; the Read-Scale availability group target from .env (today host 10.10.33.141, not in Inventory) with a valid SQL password,
//   which the test adds itself as the "existing item". If its host is already in Inventory under another name the test ends ABORTED.
// Inventory side effects: adds one Inventory item named "P06-154609"; opens its Edit form and cancels it without saving; removes the item (Remove host and keep
//   transporter) afterwards. Nothing else is touched.
// case-vs-ui: Xray precondition "an existing Microsoft SQL Server instance with a saved SQL password" is created by the test; the standalone instance host is already
//   in Inventory under another item, so the free Read-Scale availability group target is used (the SQL password field is the same on every type).
// case-vs-ui: Xray "Edit / Manage ... Step 2 - Options" is one "Edit: <name>" form in the current UI.
// case-vs-ui: only "the field does not hold the real saved password" is asserted (the Edit form shows a masked pre-filled value); the Edit-load network traffic is not inspected.
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P06-154609';
const created = new Set<string>();

test.afterEach(async ({ inventoryFlows }) => {
  for (const name of created) {
    try {
      await inventoryFlows.gotoInventory();
      if (await inventoryFlows.hasItem(name)) await inventoryFlows.waitForDiscovery(name, 600_000);
      await inventoryFlows.discardIfPresent(name);
    } catch {
      // Best effort: the original failure is what the report shows.
    }
  }
  created.clear();
});

test(
  'NAKIVO Edit form of an existing Microsoft SQL Server item does not load the saved SQL password into the field',
  { tag: '@NJM-154609' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, addInventoryItemPage, editInventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);

    await test.step('1. Precondition: an existing Microsoft SQL Server item with a saved SQL password is in Inventory', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The test adds its own item (Read-Scale availability group target) and waits for its discovery; the standalone instance host is already in Inventory under another item.' });
      await flows.gotoInventory();
      // The name is an ordinary one: an existing item with it is not the test's own, so it is never touched.
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
      await flows.startAdd(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      await flows.fillAddForm({ displayName: ITEM_NAME, ...target });
      created.add(ITEM_NAME);
      const outcome = await flows.finishAdd();
      // A duplicate means the host is already in Inventory under another name, so the case cannot run (ABORTED), it did not fail.
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
      expect(await flows.waitForDiscovery(ITEM_NAME, 600_000), 'discovery of the item did not complete').toBe('discovered');
    });

    await test.step('2. Select the existing item and open Edit; the Options form of the item opens', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray "Edit / Manage ... Step 2 - Options" is one "Edit: <name>" form in the current UI.' });
      await flows.openItem(ITEM_NAME);
      await flows.openEditForm();
      await expect(editInventoryItemPage.displayNameField).toHaveValue(ITEM_NAME);
    });

    await test.step('3. Inspect the SQL password right after opening Edit; the saved password is not loaded into the field', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Edit form shows a masked pre-filled value in the SQL password field. Asserted: it is not empty and is not the real password. The network traffic that loads the form is not inspected.' });
      const shown = await editInventoryItemPage.field('sqlPassword').inputValue({ timeout: 10_000 });
      expect(shown.length, 'the SQL password field of the Edit form is empty (a masked value is expected)').toBeGreaterThan(0);
      expect(shown === target.sqlPassword, 'the Edit form shows the real saved SQL password').toBe(false);
      // Leave the Edit form without saving (the afterEach then reloads Inventory, which needs no confirmation).
      await editInventoryItemPage.cancel();
    });
  },
);
