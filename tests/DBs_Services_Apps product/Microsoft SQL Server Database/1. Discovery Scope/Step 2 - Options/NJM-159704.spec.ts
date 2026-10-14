import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159704: "[MSSQL-Inv-UI-Options-0025-2] Verify Finish Initiates Discovery - Microsoft SQL Server failover cluster instance".
// Lab preconditions: signed-in Director; the failover cluster target of .env (mssqlFciTarget, FCI-33.140) whose host is NOT already in Inventory under any
//   name (the Director then answers with the duplicate message and the test ends ABORTED; today FCI-33.140 is in Inventory and Inaccessible: remove it and
//   repair the cluster first); no Inventory item named P08-159704.
// Inventory side effects: adds one item named P08-159704 (installs or reuses the transporter on the host); afterEach waits for its discovery to end and
//   cancels it (Failed row) or removes it (Remove host and keep transporter). Only this name is touched.
// case-vs-ui (steps 1-3): Xray "Add" > Microsoft SQL Server is the "+" button and the "Application" tile; the UI has no "Step 1 connection details":
//   Step 1 is the Platform and every field is on the "Options" step, which is where the connection details are entered.
// case-vs-ui (step 4): the case data lists SQL credentials only; the form also requires the OS credentials, which are filled as well.
// case-vs-ui (step 5): discovery shows as the Inventory row "Adding... 0%" (later "N databases"); no discovery task or Activities entry is shown.
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P08-159704';
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
  'NAKIVO Add wizard starts discovery of a failover cluster instance when Finish is clicked with valid data',
  { tag: '@NJM-159704' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlFciTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);

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

    await test.step('4. Enter valid credentials and options; all required fields are populated with valid values', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case data lists SQL credentials only; the form also requires the OS credentials, which are filled as well.' });
      await flows.fillAddForm({ displayName: ITEM_NAME, ...target });
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('username', 0)).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('instanceName')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('username', 1)).toHaveAttribute('aria-invalid', 'false');
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
    });

    await test.step('5. Click Finish; the wizard closes and the item is listed in Inventory with discovery in progress', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Discovery in progress shows as the row "Adding... 0%" (or already "N databases"); no discovery task or Activities entry exists in the current Director.' });
      created.add(ITEM_NAME);
      const outcome = await flows.finishAdd();
      // A duplicate means the host is already in Inventory under another name, so the case cannot run (ABORTED), it did not fail.
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(addInventoryItemPage.title).toBeHidden();
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
      await expect(inventoryPage.row(ITEM_NAME).getByText(/Adding\.\.\.|\d+ databases?/)).toBeVisible();
    });
  },
);
