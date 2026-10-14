import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-157714: "Verify error on wrong password for Read-Scale (Ref: MSSQL-Disc-0007-4)".
// Lab preconditions: the Read-Scale availability group target of .env (mssqlReadScaleTarget, host 10.10.33.141, ReadScaleAG) is reachable and
//   its host is NOT already in Inventory under any name (the Director then answers with the duplicate message and the test ends ABORTED);
//   no Inventory item named DISC-WRONGPW-RSAG. Today 10.10.33.141 is not in Inventory.
// Inventory side effects: adds one item named DISC-WRONGPW-RSAG that ends as a Failed row; afterEach cancels it (Failed row > Cancel).
// case-vs-ui (step 1): the UI cannot show that the replicas answer ping/port; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 2-3): Application is chosen in the Add Inventory Item wizard (Settings > Inventory > +), then the Type combo is set to the
//   Read-Scale availability group type; one UI action covers both case steps, and the form asks for the SQL Server hosting the primary replica
//   (Hostname or IP) and the clusterless AG name, not a listener.
// case-vs-ui (steps 5-7): the wizard closes at Finish, the row shows Adding... and then Failed; the error is shown by the row menu Show error,
//   not in the wizard, and the item stays listed as Failed until it is cancelled (the case says it is not added).
// case-vs-ui (step 6): the wording of the credentials error was observed for an instance; the same sentence is expected for a Read-Scale AG.
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
  'NAKIVO user sees a credentials error and no discovered item when a Microsoft SQL Server Read-Scale availability group is added with a wrong SQL password',
  { tag: '@NJM-157714' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, wizardFlows, inventoryPage, addInventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(900_000);
    const displayName = 'DISC-WRONGPW-RSAG';
    const wrongSqlPassword = `${target.sqlPassword}x`;
    const form = { displayName, ...target, sqlPassword: wrongSqlPassword };

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
    });

    await test.step('2. Open the Add wizard and choose Application', async () => {
      // startAdd opens the wizard, chooses Application, goes to the Options step and sets the Type (case steps 2 and 3 are one UI action).
      await flows.startAdd(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Choose Microsoft SQL Server (Read-Scale availability group): the form shows the host and credential fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('4. Enter the Read-Scale AG host and an incorrect SQL password: the values are accepted into the fields', async () => {
      await flows.fillAddForm(form);
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
      await expect.poll(async () => (await wizardFlows.fieldState('availabilityGroupName')).value, { message: 'AG name does not hold the typed value' }).toBe(target.agName);
      await expect.poll(async () => (await wizardFlows.fieldState('username', 1)).value, { message: 'SQL username does not hold the typed value' }).toBe(target.sqlUsername);
      // Compared as a boolean so that no password can appear in a failure message.
      expect((await wizardFlows.fieldState('password', 1)).value === wrongSqlPassword, 'SQL password does not hold the typed (wrong) value').toBe(true);
    });

    await test.step('5. Finish: discovery starts and then fails on authentication', async () => {
      const outcome = await flows.finishAdd();
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      expect(await flows.waitForDiscovery(displayName, 600_000), 'the add did not end as Failed').toBe('failed');
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157714 step 5: the wizard closes at Finish and the failure shows as a Failed Inventory row, not as a message in the wizard.' });
    });

    await test.step('6. The error of the failed add says the credentials are incorrect', async () => {
      const text = await flows.showFailedItemError(displayName);
      expect(text).toMatch(/Provided SQL credentials are incorrect or have insufficient permissions/);
      await flows.closeFailedItemError();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157714 step 6: the message is read through the Failed row menu Show error, not in the discovery dialog; the sentence was observed for an instance and is assumed the same for a Read-Scale availability group.' });
    });

    await test.step('7. The Read-Scale availability group has not been discovered into Inventory', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toHaveCount(0);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157714 step 7: the item is not discovered, but the UI keeps it listed as a Failed row until it is cancelled; the case says it is not added.' });
    });
  },
);
