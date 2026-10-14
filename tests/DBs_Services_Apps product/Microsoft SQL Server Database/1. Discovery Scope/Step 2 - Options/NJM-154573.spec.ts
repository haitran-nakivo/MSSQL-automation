import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154573: "[DBM-Inv-UI-Add-Options-0030] Verify Finish Initiates Discovery".
// Lab preconditions: signed-in Director; the standalone instance target from .env (today 10.10.19.145, which is already in Inventory
//   as WS2022-SQL2025-19.145: the Director then answers "Duplicate entries are not allowed" and the test ends ABORTED until that item is removed by the owner).
// Inventory side effects: adds one Inventory item named "P05-154573" (installs or reuses the transporter on the host); the test
//   waits for its discovery to end and removes it (Remove host and keep transporter) afterwards. Nothing else is touched.
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case data omits Instance name and the SQL credentials, which the form requires; they are filled as well. Type = Microsoft SQL Server instance.
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P05-154573';
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
  'NAKIVO Add wizard starts discovery of the added item when Finish is clicked with valid data',
  { tag: '@NJM-154573' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);

    await test.step('1. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens at the Platform step', async () => {
      await flows.gotoInventory();
      // The name is an ordinary one: an existing item with it is not the test's own, so it is never touched.
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile.' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Fill in all required fields with valid values; all fields are accepted', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case data omits Instance name and the SQL credentials, which the form also requires; they are filled as well. Type = Microsoft SQL Server instance.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await wizardFlows.enter('name', ITEM_NAME);
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('instanceName', target.instanceName);
      await wizardFlows.enter('username', target.sqlUsername, 1);
      await wizardFlows.enter('password', target.sqlPassword, 1);
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('username', 0)).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('instanceName')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('username', 1)).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('4. Click Finish; the wizard closes and the item is listed in Inventory as being added (discovery running)', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The current Director shows no discovery task or Activities entry; discovery shows as the Inventory row "Adding... 0%" that later becomes "N databases". That row state is what is asserted.' });
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
