import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159703: "[MSSQL-Inv-UI-Options-0032] Verify Field Highlight on Error If any field contains an invalid value".
// Lab preconditions: signed-in Director (no SQL target is needed; the instance type is used).
// Inventory side effects: none (Finish is blocked by the invalid form, so no item is created; the wizard is left by returning to the Inventory list).
// case-vs-ui (steps 2-3): Xray "Add" > Microsoft SQL Server is the "+" button and the "Application" tile; the UI has no "Step 1 connection details":
//   Step 1 is the Platform and every field is on the "Options" step. The case does not name a type; Microsoft SQL Server instance is used.
// case-vs-ui (steps 4-5): the case does not name the field or the value; the Hostname or IP field gets "bad host name" (observed to be flagged).
//   "highlighted" is aria-invalid="true" (with the red border); the computed border colour is not asserted.
test.use(RUN_OPTIONS);

const INVALID_HOST = 'bad host name';

test(
  'NAKIVO Add wizard highlights a field with an invalid value and stays open when Finish is clicked',
  { tag: '@NJM-159703' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, addInventoryItemPage, wizardFlows }, testInfo) => {
    await test.step('1. Open Settings > Inventory; the Inventory list is displayed with the Add button', async () => {
      await flows.gotoInventory();
    });

    await test.step('2. Click Add, choose Application (Microsoft SQL Server) and proceed; the Add wizard opens', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" as the platform; the UI offers the "Application" tile. startAdd also sets the instance Type.' });
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Proceed to Step 2 - Options; the Options page of the instance is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI has no Step 1 connection details (Step 1 is the Platform); no host is entered there. The case leaves the type open; the instance type is used.' });
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
    });

    await test.step('4. Enter an invalid value in the Hostname or IP field; the value is entered', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case names no field or value; Hostname or IP = "bad host name" (observed to be flagged as invalid).' });
      await wizardFlows.enter('host', INVALID_HOST);
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(INVALID_HOST);
    });

    await test.step('5. Click Finish; the field with the invalid value is highlighted and the wizard does not proceed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The highlight is checked as aria-invalid="true" on the field; the red colour itself is not measured.' });
      await wizardFlows.finish();
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'true');
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(wizardFlows.finishButton).toBeVisible();
    });
  },
);
