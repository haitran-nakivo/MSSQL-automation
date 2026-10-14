import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-157746: "Verify editing Read-Scale AG details (Ref: MSSQL-Inv-General-0004-1)".
// Lab preconditions: the Read-Scale AG target of .env (mssqlReadScaleTarget, 10.10.33.141, ReadScaleAG) is reachable and its host is NOT already
//   in Inventory under any name (duplicate = ABORTED); no item named P02-157746 or P02-157746-e. The test adds its own item.
// Inventory side effects: adds one item named P02-157746, renames it to P02-157746-e; afterEach removes it (keep transporter) or cancels it if Failed.
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
  'NAKIVO user can edit a Microsoft SQL Server Read-Scale availability group item and it is rediscovered with its databases',
  { tag: '@NJM-157746' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, editInventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'P02-157746';
    const editedName = `${displayName}-e`;

    await test.step('1. Precondition: the Read-Scale AG is in Inventory with discovered databases', async () => {
      await flows.gotoInventory();
      if ((await flows.hasItem(displayName)) || (await flows.hasItem(editedName))) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" or "${editedName}" already exists; remove it and run again`);
      }
      await flows.startAdd(ITEM_TYPES.readScale);
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      created.add(editedName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the Read-Scale AG did not complete').toBe('discovered');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
    });

    await test.step('2. Open the item and click Edit: the dialog is pre-populated with the current connection details', async () => {
      await flows.openItem(displayName);
      await flows.openEditForm();
      await expect
        .poll(() => flows.readEditForm(), { message: 'the Edit wizard is not pre-populated with the current settings' })
        .toEqual({ displayName, host: target.host, osUsername: target.osUsername, agName: target.agName, sqlUsername: target.sqlUsername });
    });

    await test.step('3. Change an editable detail: the new value is accepted without a validation error', async () => {
      await editInventoryItemPage.setDisplayName(editedName);
      await expect(editInventoryItemPage.field('displayName')).toHaveValue(editedName);
      await expect(editInventoryItemPage.field('displayName')).not.toHaveAttribute('aria-invalid', 'true');
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157746 step 3: the Display name is changed instead of the SQL credentials (the lab has one valid credential pair).' });
    });

    await test.step('4. Save: the edit is saved and the Read-Scale AG is rediscovered', async () => {
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
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the rediscovered Read-Scale AG' })
        .toMatchObject({ type: ITEM_TYPES.readScale, agName: target.agName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
    });
  },
);
