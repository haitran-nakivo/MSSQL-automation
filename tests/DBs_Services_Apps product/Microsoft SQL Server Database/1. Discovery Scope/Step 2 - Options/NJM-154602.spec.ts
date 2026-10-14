import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154602: "[MSSQL-Inv-UI-Options-0023-5-1] Verify SQL Password is Not Required - Microsoft SQL Server instance".
// Lab preconditions: signed-in Director; the Read-Scale availability group target from .env (today host 10.10.33.141, not in Inventory). If its host is
//   already in Inventory under another name the Director answers "Duplicate entries are not allowed" and the test ends ABORTED.
// Inventory side effects: adds one Inventory item named "P06-154602" with an empty SQL password (it is expected to end as a Failed row); the test removes
//   (Remove host and keep transporter) or cancels it afterwards. Nothing else is touched.
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the case title says "instance", but the standalone instance host is already in Inventory (an add would be a duplicate); the free Read-Scale
//   availability group target is used. The SQL password field is the same on every type.
// case-vs-ui: the wizard has no Next/Apply on the Options step; the attempt to proceed is the Finish button. Xray's "not required" is what the UI shows
//   (the SQL password is not marked invalid; the Xray description says "required", the current UI is the reference).
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P06-154602';
const created = new Set<string>();

test.afterEach(async ({ inventoryFlows }) => {
  for (const name of created) {
    try {
      await inventoryFlows.gotoInventory();
      await inventoryFlows.discardIfPresent(name);
    } catch {
      // Best effort: the original failure is what the report shows.
    }
  }
  created.clear();
});

test(
  'NAKIVO Add wizard accepts an empty SQL password: it is not marked as required and Finish starts the add',
  { tag: '@NJM-154602' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(600_000);

    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      await flows.gotoInventory();
      // The name is an ordinary one: an existing item with it is not the test's own, so it is never touched.
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile. Xray step 2 "Add New" is merged into step 1 (the wizard is already open).' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Fill the required fields and leave the SQL password empty; the SQL password is empty', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case title says instance; the Read-Scale availability group type is used because the standalone instance host is already in Inventory (an add would be a duplicate). The SQL password field is the same on every type.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      await wizardFlows.enter('name', ITEM_NAME);
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('availabilityGroupName', target.agName);
      await wizardFlows.enter('username', target.sqlUsername, 1);
      await expect(addInventoryItemPage.input('password', 1)).toHaveValue('');
    });

    await test.step('4. Click Finish; the wizard proceeds with the empty SQL password and shows no required-field error', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Options step has Finish, not Next/Apply. What happens to the item afterwards (it is expected to end as a Failed row) is not part of the case and is not asserted.' });
      await expect(addInventoryItemPage.input('password', 1)).toHaveAttribute('aria-invalid', 'false');
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
