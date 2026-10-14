import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-157737: "Verify error420 when credentials have insufficient permission on Always On AG (Ref: MSSQL-Disc-0012-3)".
// Lab preconditions: the Always On availability group target of .env (mssqlAgTarget) is reachable and its host is NOT already in Inventory under any name (the
//   Director then answers with the duplicate message and the test ends ABORTED); the low-privilege SQL login of .env (NAKIVO_MSSQL_LOWPERM_SQL_USERNAME /
//   _SQL_PASSWORD) exists on the AG replica (the owner creates it); no Inventory item named DISC-PERM-AAG. Today AAG-36.6 (10.10.36.6) is in Inventory and the
//   .env AG variables still point at the old host 10.10.38.76 / AG_TESTDB84: update .env to 10.10.36.6 / AG_TESTDB86 and remove AAG-36.6 from Inventory first.
// Inventory side effects: adds one item named DISC-PERM-AAG that ends as a Failed row; afterEach cancels it (Failed row > Cancel).
// case-vs-ui (step 1): the UI cannot show that the AAG is online or that the limited login exists; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 3-4): Application is chosen in the Add Inventory Item wizard (Settings > Inventory > +); the default Type is Always On availability
//   group; one UI action covers both case steps, and the form asks for the WSFC host (Hostname or IP) and the AG name, not a listener and an instance.
// case-vs-ui (steps 5-7): the wizard closes at Finish, the row shows Adding... and then Failed; the error is shown by the row menu Show error, not in the
//   wizard, and the item stays listed as Failed until it is cancelled (the case says it is not added).
// case-vs-ui (step 6): "error 420" is an internal id that the UI does not show; the text of Show error is matched against the words of the case
//   (insufficient / permission / rights / privilege) and attached to the test as evidence.
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
  'NAKIVO user sees an insufficient-permission error and no discovered item when a Microsoft SQL Server Always On availability group is added with a low-privilege SQL login',
  { tag: '@NJM-157737' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, wizardFlows, inventoryPage, addInventoryItemPage, mssqlAgTarget: target, mssqlLowPermLogin: lowPerm }, testInfo) => {
    test.setTimeout(900_000);
    const displayName = 'DISC-PERM-AAG';
    const form = { displayName, ...target, sqlUsername: lowPerm.sqlUsername, sqlPassword: lowPerm.sqlPassword };

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
    });

    await test.step('2. Open the Inventory page', async () => {
      await flows.gotoInventory();
      await expect(page).toHaveURL(/configuration/);
    });

    await test.step('3. Open the Add wizard and choose Application', async () => {
      // startAdd opens the wizard, chooses Application and goes to the Options step; the default Type is kept (case steps 3 and 4 are one UI action).
      await flows.startAdd();
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('4. Microsoft SQL Server (Always On availability group): the form shows the host and credential fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(AAG_TYPE);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('5. Enter the availability group host and the low-privilege SQL login and start discovery', async () => {
      await flows.fillAddForm(form);
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
      await expect.poll(async () => (await wizardFlows.fieldState('availabilityGroupName')).value, { message: 'AG name does not hold the typed value' }).toBe(target.agName);
      await expect.poll(async () => (await wizardFlows.fieldState('username', 1)).value, { message: 'SQL username does not hold the typed value' }).toBe(lowPerm.sqlUsername);
      const outcome = await flows.finishAdd();
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
    });

    await test.step('6. Discovery fails and the error says the credentials have insufficient permission', async () => {
      expect(await flows.waitForDiscovery(displayName, 600_000), 'the add did not end as Failed').toBe('failed');
      const text = await flows.showFailedItemError(displayName);
      await testInfo.attach('show-error-text', { body: text, contentType: 'text/plain' });
      expect(text).toMatch(/insufficient|permission|rights|privilege/i);
      await flows.closeFailedItemError();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157737 step 6: the wizard closes at Finish and the failure shows as a Failed row; the message is read through the row menu Show error, and "error 420" is not displayed.' });
    });

    await test.step('7. The Always On availability group has not been discovered into Inventory', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toHaveCount(0);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157737 step 7: the item is not discovered, but the UI keeps it listed as a Failed row until it is cancelled; the case says it is not added.' });
    });
  },
);
