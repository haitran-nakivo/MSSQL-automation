import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154612: "[MSSQL-Inv-UI-Options-0025-1] Verify Finish Initiates Discovery - Microsoft SQL Server instance".
// Lab preconditions: signed-in Director; the standalone instance target from .env (today 10.10.19.145, which is already in Inventory
//   as WS2022-SQL2025-19.145: the Director then answers "Duplicate entries are not allowed" and the test ends ABORTED until that item is removed by the owner).
// Inventory side effects: adds one Inventory item named "P06-154612" (installs or reuses the transporter on the host); the test waits for its discovery
//   to end and removes it (Remove host and keep transporter) afterwards. Nothing else is touched.
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is "Settings > Inventory", the "+" button and the "Application" tile.
// case-vs-ui: Xray "Discovery of the instance and its databases completes" is the Inventory row changing from "Adding..." to "N databases" and the item page showing the databases and No Issues.
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P06-154612';
const DATABASE_COUNT = /^[1-9]\d*$/;
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
  'NAKIVO Add wizard starts discovery of a Microsoft SQL Server instance on Finish and the instance is added to Inventory with its databases',
  { tag: '@NJM-154612' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);

    await test.step('1. Precondition: Director is up and the Microsoft SQL Server Application option is available in Inventory', async () => {
      await flows.gotoInventory();
      // The name is an ordinary one: an existing item with it is not the test's own, so it is never touched.
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray "Add New > Application/Database > Microsoft SQL Server" is the "+" button and the "Application" tile; Xray step 1 and 2 are merged (the wizard is opened in step 1).' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Keep the type Microsoft SQL Server instance and enter the instance name; the Instance name field accepts the value', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The wizard default type is Always On, so the type Microsoft SQL Server instance is chosen explicitly; the remaining required fields (Hostname or IP, OS credentials) are filled in this step.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await wizardFlows.enter('name', ITEM_NAME);
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('instanceName', target.instanceName);
      await expect(addInventoryItemPage.input('instanceName')).toHaveValue(target.instanceName);
      await expect(addInventoryItemPage.input('instanceName')).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('4. Enter the SQL credentials and click Finish; the wizard closes and discovery of the instance starts', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The current Director shows no discovery task or Activities entry; discovery shows as the Inventory row "Adding... 0%". That row state is what is asserted.' });
      await wizardFlows.enter('username', target.sqlUsername, 1);
      await wizardFlows.enter('password', target.sqlPassword, 1);
      created.add(ITEM_NAME);
      const outcome = await flows.finishAdd();
      // A duplicate means the host is already in Inventory under another name, so the case cannot run (ABORTED), it did not fail.
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(addInventoryItemPage.title).toBeHidden();
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
      await expect(inventoryPage.row(ITEM_NAME).getByText(/Adding\.\.\.|\d+ databases?/)).toBeVisible();
    });

    await test.step('5. Wait for the discovery to complete; the instance and its databases are discovered and the instance is in Inventory', async () => {
      expect(await flows.waitForDiscovery(ITEM_NAME, 600_000), 'discovery of the instance did not complete').toBe('discovered');
      await expect(inventoryPage.row(ITEM_NAME).getByText('Failed', { exact: true })).toBeHidden();
      await flows.openItem(ITEM_NAME);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered Microsoft SQL Server instance' })
        .toMatchObject({ type: ITEM_TYPES.instance, totalDatabases: expect.stringMatching(DATABASE_COUNT), noIssues: true });
      await flows.gotoInventory();
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
    });
  },
);
