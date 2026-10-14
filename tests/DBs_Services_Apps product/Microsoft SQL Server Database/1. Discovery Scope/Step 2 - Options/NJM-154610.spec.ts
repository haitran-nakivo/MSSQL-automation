import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { clickRightEdgeAndReadType } from '../../../../../flows/pkg-obsa.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154610: "[MSSQL-Inv-UI-Options-0023-6-7-1-TC03] Verify Password Fake Display on Edit".
// Lab preconditions: signed-in Director; the Read-Scale availability group target from .env (today host 10.10.33.141, not in Inventory) with a valid SQL password,
//   which the test adds itself as the "existing item". If its host is already in Inventory under another name the test ends ABORTED.
// Inventory side effects: adds one Inventory item named "P06-154610"; opens its Edit form and cancels it without saving; removes the item (Remove host and keep
//   transporter) afterwards. Nothing else is touched.
// case-vs-ui: Xray precondition "an existing Microsoft SQL Server instance with a saved SQL password" is created by the test; the standalone instance host is already
//   in Inventory under another item, so the free Read-Scale availability group target is used (the SQL password field is the same on every type).
// case-vs-ui: Xray "Edit / Manage ... Step 2 - Options" is one "Edit: <name>" form in the current UI.
// case-vs-ui: step 4 expects an eye toggle to reveal the placeholder; the UI has no eye toggle (the input stays type="password", also after a click on the field's right edge),
//   so the revealed content cannot be shown. Asserted instead: the field still shows the same masked value and it is not the real password.
// notVerified: that the placeholder has a FIXED length (only "not empty and not the real password" is asserted) and that the Edit-load traffic carries no real password.
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P06-154610';
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
  'NAKIVO Edit form of an existing Microsoft SQL Server item shows a masked placeholder in the SQL password field and no eye toggle exposes the real password',
  { tag: '@NJM-154610' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, addInventoryItemPage, editInventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    let placeholder = '';

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

    await test.step('3. Inspect the SQL password field in edit mode; a masked placeholder is shown, not the real password', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Asserted: the field is type="password", not empty and not the real password. A fixed placeholder length is not asserted (not observed).' });
      const field = editInventoryItemPage.field('sqlPassword');
      await expect(field).toHaveAttribute('type', 'password');
      placeholder = await field.inputValue({ timeout: 10_000 });
      expect(placeholder.length, 'the SQL password field of the Edit form is empty (a masked value is expected)').toBeGreaterThan(0);
      expect(placeholder === target.sqlPassword, 'the Edit form shows the real saved SQL password').toBe(false);
    });

    await test.step('4. Try to reveal the SQL password without re-typing; no eye toggle exists and the real password is never exposed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects an eye toggle to reveal the placeholder; the UI has no eye toggle: the input stays type="password" after a click on the right edge of the field.' });
      const field = editInventoryItemPage.field('sqlPassword');
      expect(await clickRightEdgeAndReadType(field), 'a click on the right edge of the SQL password field changed its input type').toBe('password');
      const after = await field.inputValue({ timeout: 10_000 });
      expect(after === placeholder, 'the SQL password field changed after the click').toBe(true);
      expect(after === target.sqlPassword, 'the Edit form exposes the real saved SQL password').toBe(false);
      // Leave the Edit form without saving (the afterEach then reloads Inventory, which needs no confirmation).
      await editInventoryItemPage.cancel();
    });
  },
);
