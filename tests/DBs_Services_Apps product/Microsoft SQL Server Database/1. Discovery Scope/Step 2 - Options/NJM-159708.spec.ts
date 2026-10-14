import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159708: "[MSSQL-Inv-UI-Options-0026-3] Verify Discovery Fails on Connection Fail - Microsoft SQL Server Always On availability group".
// Lab preconditions: signed-in Director; the Always On AG target of .env (mssqlAgTarget; today the .env still points at the old 10.10.38.76 / AG_TESTDB84:
//   update it to 10.10.36.6 / AG_TESTDB86) whose host is NOT already in Inventory under any name (AAG-36.6 is in Inventory today: remove it first,
//   otherwise the Director answers with the duplicate message and the test ends ABORTED); no Inventory item named P08-159708.
// Inventory side effects: adds one item named P08-159708 that ends as a Failed row; afterEach cancels it (Failed row > Cancel). Only this name is touched.
// case-vs-ui (steps 1-3): Xray "Add" > Microsoft SQL Server is the "+" button and the "Application" tile; the UI has no "Step 1 connection details":
//   Step 1 is the Platform and every field is on the "Options" step. Always On is the default Type.
// case-vs-ui (step 4): the case allows "unreachable host or invalid credentials"; invalid credentials are used (the real target host with a wrong SQL password).
// case-vs-ui (step 5): the wizard closes at Finish and the failure shows as a Failed Inventory row with its error in the row menu Show error; the wording
//   "connection failure" is not shown: the observed credentials sentence is asserted (observed for an instance, assumed the same for this type).
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P08-159708';
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
  'NAKIVO user sees discovery of an Always On availability group fail with an error when the connection credentials are wrong',
  { tag: '@NJM-159708' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlAgTarget: target }, testInfo) => {
    test.setTimeout(900_000);
    const wrongSqlPassword = `${target.sqlPassword}x`;

    await test.step('1. Open Settings > Inventory; the Inventory list is displayed with the Add button', async () => {
      await flows.gotoInventory();
      // The name is an ordinary one: an existing item with it is not the test's own, so it is never touched.
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
    });

    await test.step('2. Click Add, choose Application (Microsoft SQL Server) and proceed; the Add wizard opens', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" as the platform; the UI offers the "Application" tile. The default Type (Always On) is kept.' });
      await flows.startAdd();
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Proceed to Step 2 - Options; the Options page of the Always On availability group is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI has no Step 1 connection details (Step 1 is the Platform); the host is entered on the Options step.' });
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
    });

    await test.step('4. Enter the availability group details with a wrong SQL password; the values are accepted in the Options fields', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case allows an unreachable host or invalid credentials; invalid credentials are used (wrong SQL password).' });
      await flows.fillAddForm({ displayName: ITEM_NAME, ...target, sqlPassword: wrongSqlPassword });
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
      await expect.poll(async () => (await wizardFlows.fieldState('availabilityGroupName')).value, { message: 'AG name does not hold the typed value' }).toBe(target.agName);
      // Compared as a boolean so that no password can appear in a failure message.
      expect((await wizardFlows.fieldState('password', 1)).value === wrongSqlPassword, 'SQL password does not hold the typed (wrong) value').toBe(true);
    });

    await test.step('5. Click Finish; discovery is initiated but fails and an error is reported for the availability group', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The wizard closes at Finish; the failure shows as a Failed row and its error is read through the row menu Show error. The credentials sentence is asserted, not a "connection failure" wording.' });
      created.add(ITEM_NAME);
      const outcome = await flows.finishAdd();
      // A duplicate means the host is already in Inventory under another name, so the case cannot run (ABORTED), it did not fail.
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
      expect(await flows.waitForDiscovery(ITEM_NAME, 600_000), 'the add did not end as Failed').toBe('failed');
      const text = await flows.showFailedItemError(ITEM_NAME);
      await testInfo.attach('failed-add-error', { body: text, contentType: 'text/plain' });
      expect(text).toMatch(/Provided SQL credentials are incorrect or have insufficient permissions/);
      await flows.closeFailedItemError();
      await expect(inventoryPage.discoveredDetails(ITEM_NAME)).toHaveCount(0);
    });
  },
);
