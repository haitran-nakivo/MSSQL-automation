import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-157744: "Verify editing Always On Availability Group details (Ref: MSSQL-Inv-General-0003-1)".
// Lab preconditions: the Always On AG target of .env (mssqlAgTarget) is reachable and its host is NOT already in Inventory under any name
//   (duplicate = ABORTED); no item named P02-157744 or P02-157744-e. The .env AG target still points at the old 10.10.38.76 / AG_TESTDB84: the
//   owner must set it to 10.10.36.6 / AG_TESTDB86. Today AAG-36.6 is in Inventory: remove it first. The test adds its own item.
// Inventory side effects: adds one item named P02-157744, renames it to P02-157744-e; afterEach removes it (keep transporter) or cancels it if Failed.
// case-vs-ui (step 1): the item is added by the test itself so that the test only ever edits an item it created.
// case-vs-ui (step 2): "Manage > Edit" is the Edit icon on the item page.
// case-vs-ui (steps 3-4): the lab has one valid SQL credential pair, so the credentials are not changed; the Display name is changed and
//   saved (button Save, not Apply/Finish); the passwords are pre-filled masked and are not typed again.
test.use(RUN_OPTIONS);

const AAG_TYPE = 'Microsoft SQL Server Always On availability group';
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
  'NAKIVO user can edit a Microsoft SQL Server Always On availability group item and it is rediscovered with its databases',
  { tag: '@NJM-157744' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, editInventoryItemPage, mssqlAgTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'P02-157744';
    const editedName = `${displayName}-e`;

    await test.step('1. Precondition: the Always On AG is in Inventory with discovered databases', async () => {
      await flows.gotoInventory();
      if ((await flows.hasItem(displayName)) || (await flows.hasItem(editedName))) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" or "${editedName}" already exists; remove it and run again`);
      }
      await flows.startAdd();
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      created.add(editedName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the Always On AG did not complete').toBe('discovered');
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
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157744 step 3: the Display name is changed instead of the SQL credentials (the lab has one valid credential pair).' });
    });

    await test.step('4. Save: the edit is saved and the AG is rediscovered', async () => {
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
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the rediscovered Always On AG' })
        .toMatchObject({ type: AAG_TYPE, agName: target.agName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
    });
  },
);
