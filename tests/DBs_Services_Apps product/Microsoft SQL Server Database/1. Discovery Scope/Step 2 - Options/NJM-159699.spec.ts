import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159699: "[MSSQL-Inv-UI-Options-0023-5-4] Verify SQL Password is Not Required - Microsoft SQL Server Read-Scale availability group".
// Lab preconditions: signed-in Director; the Read-Scale AG target of .env (mssqlReadScaleTarget, 10.10.33.141 / ReadScaleAG, free today) whose host is NOT
//   already in Inventory under any name (otherwise the Director answers with the duplicate message and the test ends ABORTED); no Inventory item named P08-159699.
// Inventory side effects: Finish adds one item named P08-159699 (with an empty SQL password it may end as a Failed row or be discovered);
//   afterEach cancels it (Failed row > Cancel) or removes it (Remove host and keep transporter). Only this name is touched.
// case-vs-ui (title vs DESC): the DESC and the spec say the SQL password is required; the title, the steps and the current UI say it is not: the UI is asserted.
// case-vs-ui (steps 2-3): Xray "Add" > Microsoft SQL Server is the "+" button and the "Application" tile; the UI has no "Step 1 connection details":
//   Step 1 is the Platform and every field is on the "Options" step, which is where the connection details are entered.
// case-vs-ui (step 4): the UI marks no required field with a red asterisk (invalid fields get a red border and aria-invalid); the absence of the flag is asserted.
// case-vs-ui (step 5): "wizard proceeds" is the wizard closing and the item row appearing; the case data omits the OS credentials, which are also filled.
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P08-159699';
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
  'NAKIVO Add wizard does not flag the SQL password as required for a Read-Scale availability group',
  { tag: '@NJM-159699' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(600_000);

    await test.step('1. Open Settings > Inventory; the Inventory list is displayed with the Add button', async () => {
      await flows.gotoInventory();
      // The name is an ordinary one: an existing item with it is not the test's own, so it is never touched.
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
    });

    await test.step('2. Click Add, choose Application (Microsoft SQL Server) and proceed; the Add wizard opens', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" as the platform; the UI offers the "Application" tile. startAdd also sets the Read-Scale availability group Type.' });
      await flows.startAdd(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Enter the connection details of the Read-Scale availability group on the Options step', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI has no Step 1 connection details (Step 1 is the Platform); the details are entered on the Options step. The SQL password is left empty.' });
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      await wizardFlows.enter('name', ITEM_NAME);
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('availabilityGroupName', target.agName);
      await wizardFlows.enter('username', target.sqlUsername, 1);
    });

    await test.step('4. The SQL password field is displayed without a required-field flag', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI marks invalid fields with a red border and aria-invalid, not with a red asterisk; the field not being flagged is asserted.' });
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
      await wizardFlows.touch('password', 1);
      await expect(addInventoryItemPage.input('password', 1)).not.toHaveAttribute('aria-invalid', 'true');
    });

    await test.step('5. Leave the SQL password empty and click Finish; the wizard proceeds without a required-field error', async () => {
      await expect.poll(async () => (await wizardFlows.fieldState('password', 1)).value, { message: 'the SQL password field is not empty' }).toBe('');
      created.add(ITEM_NAME);
      const outcome = await flows.finishAdd();
      // A duplicate means the host is already in Inventory under another name, so the case cannot run (ABORTED), it did not fail.
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish with an empty SQL password').toBe('added');
      await expect(addInventoryItemPage.title).toBeHidden();
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
    });
  },
);
