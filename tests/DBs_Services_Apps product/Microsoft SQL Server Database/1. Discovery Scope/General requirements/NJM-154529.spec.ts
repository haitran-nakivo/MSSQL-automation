import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154529: "Verify editing SQL Server Instance details (Ref: MSSQL-Inv-General-0001-1)".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in Inventory under
//   any name (the Director then answers with the duplicate message and the test ends ABORTED); no item named P02-154529 or P02-154529-e.
//   Today WS2022-SQL2025-19.145 is in Inventory: remove it first. The test adds its own item (it never edits one it did not create).
// Inventory side effects: adds one item named P02-154529, renames it to P02-154529-e; afterEach removes it (keep transporter).
// case-vs-ui (step 1): the item is added by the test itself so that the test only ever edits an item it created.
// case-vs-ui (step 2): "Manage > Edit" is the Edit icon on the item page.
// case-vs-ui (steps 3-4): the lab has one valid SQL credential pair, so the credentials are not changed; the Display name is changed and
//   saved (button Save, not Apply/Finish); the passwords are pre-filled masked and are not typed again.
test.use(RUN_OPTIONS);

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

test(
  'NAKIVO user can edit a Microsoft SQL Server instance item and the instance is rediscovered with its databases',
  { tag: '@NJM-154529' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, editInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'P02-154529';
    const editedName = `${displayName}-e`;
    const instanceField = page.locator('input[name="instanceName"]:visible');

    await test.step('1. Precondition: the instance is in Inventory with discovered databases', async () => {
      await flows.gotoInventory();
      if ((await flows.hasItem(displayName)) || (await flows.hasItem(editedName))) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" or "${editedName}" already exists; remove it and run again`);
      }
      await flows.startAdd(ITEM_TYPES.instance);
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      created.add(editedName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the instance did not complete').toBe('discovered');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
    });

    await test.step('2. Open the item and click Edit: the dialog is pre-populated with the current connection details', async () => {
      await flows.openItem(displayName);
      await flows.openEditForm();
      await expect(editInventoryItemPage.field('displayName')).toHaveValue(displayName);
      await expect(editInventoryItemPage.field('host')).toHaveValue(target.host);
      await expect(editInventoryItemPage.field('osUsername')).toHaveValue(target.osUsername);
      await expect(instanceField).toHaveValue(target.instanceName);
      await expect(editInventoryItemPage.field('sqlUsername')).toHaveValue(target.sqlUsername);
    });

    await test.step('3. Change an editable detail: the new value is accepted without a validation error', async () => {
      await editInventoryItemPage.setDisplayName(editedName);
      await expect(editInventoryItemPage.field('displayName')).toHaveValue(editedName);
      await expect(editInventoryItemPage.field('displayName')).not.toHaveAttribute('aria-invalid', 'true');
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154529 step 3: the Display name is changed instead of the SQL credentials (the lab has one valid credential pair).' });
    });

    await test.step('4. Save: the edit is saved and the instance is rediscovered', async () => {
      await editInventoryItemPage.save();
      await expect(editInventoryItemPage.displayNameField).toBeHidden({ timeout: 30_000 });
      await flows.gotoInventory();
      await expect(inventoryPage.item(editedName)).toBeVisible();
      await expect(inventoryPage.item(displayName)).toHaveCount(0);
      expect(await flows.waitForDiscovery(editedName, 300_000), 'rediscovery after the edit did not complete').toBe('discovered');
      await expect(inventoryPage.row(editedName).getByText('Failed', { exact: true })).toBeHidden();
    });

    await test.step('5. Reopen the item: the change persisted and the databases are still discovered', async () => {
      await flows.openItem(editedName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the rediscovered instance' })
        .toMatchObject({ type: ITEM_TYPES.instance, instanceName: target.instanceName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
    });
  },
);
