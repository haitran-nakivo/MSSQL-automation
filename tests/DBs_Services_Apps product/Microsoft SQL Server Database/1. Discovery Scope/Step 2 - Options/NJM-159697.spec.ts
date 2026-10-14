import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159697: "[MSSQL-Inv-UI-Options-0023-5-2] Verify SQL Password is Not Required - Microsoft SQL Server failover cluster instance".
// Lab preconditions: signed-in Director; the failover cluster target of .env (mssqlFciTarget, FCI-33.140) whose host is NOT already in Inventory
//   under any name (the Director then answers with the duplicate message and the test ends ABORTED; today FCI-33.140 is in Inventory and Inaccessible);
//   no Inventory item named P08-159697.
// Inventory side effects: Finish adds one item named P08-159697 (with an empty SQL password it may end as a Failed row or be discovered);
//   afterEach cancels it (Failed row > Cancel) or removes it (Remove host and keep transporter). Only this name is touched.
// case-vs-ui (title vs DESC): the DESC and the spec say the SQL password is required; the title, the steps and the current UI say it is not: the UI is asserted.
// case-vs-ui (step 1): the UI cannot show the license content or that the SQL host is reachable; only the signed-in Director and the Inventory page are checked.
// case-vs-ui (step 2): Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is Settings > Inventory > "+" > "Application" tile > Next.
// case-vs-ui (steps 4-5): "wizard proceeds" is the wizard closing and the item row appearing; the case data omits the OS credentials, which are also filled.
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P08-159697';
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
  'NAKIVO Add wizard does not flag the SQL password as required for a failover cluster instance',
  { tag: '@NJM-159697' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlFciTarget: target }, testInfo) => {
    test.setTimeout(600_000);
    let outcome: 'added' | 'duplicate' | 'timeout' = 'timeout';

    await test.step('1. Precondition: Director is accessible, the Microsoft SQL Server platform is available and no item with the test name exists', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI cannot show the license content or that the SQL host is reachable; only the signed-in Director and the Inventory page are checked.' });
      await flows.gotoInventory();
      // The name is an ordinary one: an existing item with it is not the test's own, so it is never touched.
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
    });

    await test.step('2. Open the Add wizard, choose Application (Microsoft SQL Server) and go to the Options step', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray "Add New > Application/Database > Microsoft SQL Server" is the "+" button and the "Application" tile; startAdd also sets the Type of step 3.' });
      await flows.startAdd(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Set Type = Microsoft SQL Server failover cluster instance; the SQL password field is displayed', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('4. Fill the other mandatory fields, leave the SQL password empty and click Finish; the SQL password is not flagged as required', async () => {
      await wizardFlows.enter('name', ITEM_NAME);
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('instanceName', target.instanceName);
      await wizardFlows.enter('username', target.sqlUsername, 1);
      await expect.poll(async () => (await wizardFlows.fieldState('password', 1)).value, { message: 'the SQL password field is not empty' }).toBe('');
      // The empty SQL password is left (touched) before Finish: the form does not flag it.
      await wizardFlows.touch('password', 1);
      await expect(addInventoryItemPage.input('password', 1)).not.toHaveAttribute('aria-invalid', 'true');
      created.add(ITEM_NAME);
      // Finish is clicked here and its outcome (wizard closed or duplicate) is read in step 5; a flagged field would keep the wizard open.
      outcome = await flows.finishAdd();
    });

    await test.step('5. The wizard proceeds without a required-field error on the SQL password', async () => {
      // A duplicate means the host is already in Inventory under another name, so the case cannot run (ABORTED), it did not fail.
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish with an empty SQL password').toBe('added');
      await expect(addInventoryItemPage.title).toBeHidden();
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
    });
  },
);
