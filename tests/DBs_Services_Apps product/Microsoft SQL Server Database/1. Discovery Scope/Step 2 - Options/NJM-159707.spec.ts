import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159707: "[MSSQL-Inv-UI-Options-0026-2] Verify Discovery Fails on Connection Fail - Microsoft SQL Server failover cluster instance".
// Lab preconditions: signed-in Director; the failover cluster target of .env (mssqlFciTarget, FCI-33.140) whose host is NOT already in Inventory under any
//   name (the Director then answers with the duplicate message and the test ends ABORTED; today FCI-33.140 is in Inventory and Inaccessible: remove it first);
//   no Inventory item named P08-159707.
// Inventory side effects: adds one item named P08-159707 that ends as a Failed row; afterEach cancels it (Failed row > Cancel). Only this name is touched.
// case-vs-ui (steps 1-3): Xray "Add" > Microsoft SQL Server is the "+" button and the "Application" tile; the UI has no "Step 1 connection details":
//   Step 1 is the Platform and every field is on the "Options" step, which is where the host is entered.
// case-vs-ui (step 4): the case allows "unreachable host or invalid credentials"; invalid credentials are used (the real target host with a wrong SQL password).
// case-vs-ui (step 5): the wizard closes at Finish and the failure shows as a Failed Inventory row with its error in the row menu Show error; the wording
//   "connection failure" is not shown: the observed credentials sentence is asserted (observed for an instance, assumed the same for this type).
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P08-159707';
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
  'NAKIVO user sees discovery of a failover cluster instance fail with an error when the connection credentials are wrong',
  { tag: '@NJM-159707' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlFciTarget: target }, testInfo) => {
    test.setTimeout(900_000);
    const wrongSqlPassword = `${target.sqlPassword}x`;

    await test.step('1. Open Settings > Inventory; the Inventory list is displayed with the Add button', async () => {
      await flows.gotoInventory();
      // The name is an ordinary one: an existing item with it is not the test's own, so it is never touched.
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
    });

    await test.step('2. Click Add, choose Application (Microsoft SQL Server) and proceed; the Add wizard opens', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" as the platform; the UI offers the "Application" tile. startAdd also sets the failover cluster instance Type.' });
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Proceed to Step 2 - Options; the Options page of the failover cluster instance is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI has no Step 1 connection details (Step 1 is the Platform); the host is entered on the Options step.' });
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
    });

    await test.step('4. Enter the cluster details with a wrong SQL password; the values are accepted in the Options fields', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case allows an unreachable host or invalid credentials; invalid credentials are used (wrong SQL password).' });
      await flows.fillAddForm({ displayName: ITEM_NAME, ...target, sqlPassword: wrongSqlPassword });
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
      await expect.poll(async () => (await wizardFlows.fieldState('instanceName')).value, { message: 'Instance name does not hold the typed value' }).toBe(target.instanceName);
      // Compared as a boolean so that no password can appear in a failure message.
      expect((await wizardFlows.fieldState('password', 1)).value === wrongSqlPassword, 'SQL password does not hold the typed (wrong) value').toBe(true);
    });

    await test.step('5. Click Finish; discovery is initiated but fails and an error is reported for the failover cluster instance', async () => {
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
