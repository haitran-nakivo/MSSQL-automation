import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159715: "[MSSQL-Inv-UI-Options-0030-4] Verify Unsupported Old Version Message - Microsoft SQL Server Read-Scale availability group".
// Lab preconditions: signed-in Director; the too-old Read-Scale AG target of .env (variable group NAKIVO_MSSQL_OLD_READSCALE_*). That group does not exist yet:
//   the test ends ABORTED ("Missing in .env") until the owner configures it. Note: a Read-Scale (clusterless) AG exists only from SQL Server 2017, so a
//   too-old host may not be possible at all; the test is written as the case states. Its host must NOT already be in Inventory; no item named P08-159715.
// Inventory side effects: Finish may leave one item named P08-159715 as a Failed row (or add nothing); afterEach cancels or removes it. Only this name is touched.
// case-vs-ui (steps 1-3): Xray "Add" > Microsoft SQL Server is the "+" button and the "Application" tile; the UI has no "Step 1 connection details":
//   Step 1 is the Platform and every field is on the "Options" step, which is where the host is entered.
// case-vs-ui (step 5): where the message shows is not known for the current Director: in the wizard, or (after the wizard closes) in the row menu Show error of a Failed row.
//   The text is matched on the case's own words (unsupported / not supported / too old / older) and attached as evidence; its exact wording is not verified.
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P08-159715';
const VERSION_MESSAGE = /unsupported|not supported|too old|older/i;
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
  'NAKIVO user sees an unsupported-version error when a Read-Scale availability group runs a too old SQL Server version',
  { tag: '@NJM-159715' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, addInventoryItemPage, wizardFlows, mssqlOldReadScaleTarget: target }, testInfo) => {
    test.setTimeout(900_000);

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

    await test.step('3. Proceed to Step 2 - Options; the Options page of the Read-Scale availability group is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI has no Step 1 connection details (Step 1 is the Platform); the host is entered on the Options step.' });
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
    });

    await test.step('4. Enter valid connection details of a Read-Scale availability group on an unsupported old SQL Server version; the values are accepted', async () => {
      await flows.fillAddForm({ displayName: ITEM_NAME, ...target });
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
      await expect.poll(async () => (await wizardFlows.fieldState('availabilityGroupName')).value, { message: 'AG name does not hold the typed value' }).toBe(target.agName);
    });

    await test.step('5. Click Finish; an error message says the SQL Server version is unsupported / too old', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Where the message shows is not known for the current Director: in the wizard, or in the Show error dialog of a Failed row. The case words are matched and the full text is attached; the exact wording is not verified.' });
      created.add(ITEM_NAME);
      const outcome = await flows.finishAdd();
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      if (outcome === 'added') {
        expect(await flows.waitForDiscovery(ITEM_NAME, 600_000), 'the add did not end as Failed').toBe('failed');
        const text = await flows.showFailedItemError(ITEM_NAME);
        await testInfo.attach('failed-add-error', { body: text, contentType: 'text/plain' });
        expect(text).toMatch(VERSION_MESSAGE);
        await flows.closeFailedItemError();
      } else {
        await expect(addInventoryItemPage.message(VERSION_MESSAGE).first()).toBeVisible();
        await testInfo.attach('wizard-error', { body: await addInventoryItemPage.message(VERSION_MESSAGE).first().innerText(), contentType: 'text/plain' });
      }
    });
  },
);
