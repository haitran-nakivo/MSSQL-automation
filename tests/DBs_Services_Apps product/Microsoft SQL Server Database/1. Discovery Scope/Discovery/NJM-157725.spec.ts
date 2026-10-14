import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-157725: "Support FULL recovery backup on AAG (Ref: MSSQL-Disc-0009-3)".
// Lab preconditions: the Always On availability group target of .env (mssqlAgTarget) is reachable, has at least one database, and its host is NOT already
//   in Inventory under any name (the Director then answers with the duplicate message and the test ends ABORTED); no Inventory item named DISC-FULL-AAG.
//   Today AAG-36.6 (10.10.36.6) is in Inventory and the .env AG variables still point at the old host 10.10.38.76 / AG_TESTDB84: update .env
//   to 10.10.36.6 / AG_TESTDB86 and remove AAG-36.6 from Inventory first.
// Inventory side effects: adds one item named DISC-FULL-AAG; afterEach removes it (Remove host and keep transporter; a Failed add is cancelled).
// case-vs-ui (step 1): the UI cannot show that the AAG is online nor the recovery model of a database; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 3-5): Application is chosen in the Add Inventory Item wizard (Settings > Inventory > +); the default Type is Always On availability
//   group; one UI action covers case steps 3-5, and the form asks for the WSFC host (Hostname or IP) and the AG name, not a listener.
// case-vs-ui (step 7): NBR shows no recovery model; only that the databases are discovered (count and AG name of the item page) is verified.
// case-vs-ui (step 8): there is no separate Save: Finish saves the item and discovery runs afterwards; the Inventory "tree" is a table.
test.use(RUN_OPTIONS);

const AAG_TYPE = 'Microsoft SQL Server Always On availability group';
const DATABASE_COUNT = /^[1-9]\d*$/;

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
  'NAKIVO user can add a Microsoft SQL Server Always On availability group and sees its databases discovered with no issues',
  { tag: '@NJM-157725' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, inventoryItemPage, addInventoryItemPage, mssqlAgTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'DISC-FULL-AAG';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157725 step 1: the UI cannot show that the AAG is online or its recovery model; only the signed-in Director and the Inventory page are checked.' });
    });

    await test.step('2. Open the Inventory page', async () => {
      await flows.gotoInventory();
      await expect(page).toHaveURL(/configuration/);
    });

    await test.step('3. Open the Add wizard and choose Application', async () => {
      // startAdd opens the wizard, chooses Application and goes to the Options step; the default Type is kept (case steps 3, 4 and 5 are one UI action).
      await flows.startAdd();
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('4. The Type list shows the Always On availability group type', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(AAG_TYPE);
    });

    await test.step('5. The form shows the host and credential fields', async () => {
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('6. Enter the availability group host and credentials and start discovery: it completes without error', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the availability group did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
    });

    await test.step('7. The databases of the availability group are discovered', async () => {
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered availability group databases' })
        .toMatchObject({ agName: target.agName, totalDatabases: expect.stringMatching(DATABASE_COUNT) });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157725 step 7: the UI shows no recovery model; only that databases are discovered is verified (the FULL recovery model is not).' });
    });

    await test.step('8. The availability group is listed in Inventory with no issues', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
      await flows.openItem(displayName);
      await expect(inventoryItemPage.noIssues).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157725 step 8: Finish saves the item (there is no separate Save); the Inventory list is a table, and "no alarms" is the No Issues badge of the item page.' });
    });
  },
);
