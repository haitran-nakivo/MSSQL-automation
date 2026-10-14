import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154614: "[MSSQL-Inv-UI-Options-0026-1] Verify Discovery Fails on Connection Fail - Microsoft SQL Server instance".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in Inventory under any name
//   (the Director then answers with the duplicate message and the test ends ABORTED); no Inventory item named P07-154614.
//   Today WS2022-SQL2025-19.145 (the host of mssqlInstanceTarget) is in Inventory: remove it first.
// Inventory side effects: adds one item named P07-154614 that ends as a Failed row; afterEach cancels it (Failed row > Cancel).
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is "Settings > Inventory", the "+" button, the "Application" tile and the Type "Microsoft SQL Server instance".
// case-vs-ui: the failing connection is made with a wrong SQL password (the case allows "unreachable host or invalid credentials").
// case-vs-ui: the wizard closes at Finish and the failure shows as a Failed row with the error in the row menu Show error; the item stays listed as Failed until it is cancelled (the case says it is not added).
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P07-154614';
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
  'NAKIVO user sees a failed discovery with a credentials error when a Microsoft SQL Server instance is added with invalid SQL credentials',
  { tag: '@NJM-154614' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(900_000);
    const wrongSqlPassword = `${target.sqlPassword}x`;

    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Reachability of the SQL host cannot be checked from the UI; a reachable host is what makes the failure a credentials failure.' });
      await flows.gotoInventory();
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile.' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
    });

    await test.step('3. Enter the instance with invalid SQL credentials; the fields accept the values', async () => {
      await flows.fillAddForm({ displayName: ITEM_NAME, ...target, sqlPassword: wrongSqlPassword });
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
      await expect.poll(async () => (await wizardFlows.fieldState('instanceName')).value, { message: 'Instance name does not hold the typed value' }).toBe(target.instanceName);
      // Compared as a boolean so that no password can appear in a failure message.
      expect((await wizardFlows.fieldState('password', 1)).value === wrongSqlPassword, 'SQL password does not hold the typed (wrong) value').toBe(true);
    });

    await test.step('4. Click Finish; the product attempts to connect and the connection attempt fails', async () => {
      const outcome = await flows.finishAdd();
      created.add(ITEM_NAME);
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The wizard closes at Finish; the failed connection shows later as a Failed Inventory row.' });
      expect(await flows.waitForDiscovery(ITEM_NAME, 600_000), 'the add did not end as Failed').toBe('failed');
    });

    await test.step('5. Observe the discovery result; discovery did not complete and an error says the connection or credentials failed', async () => {
      const text = await flows.showFailedItemError(ITEM_NAME);
      await testInfo.attach('failed-add-error-text', { body: text, contentType: 'text/plain' });
      expect(text).toMatch(/Provided SQL credentials are incorrect or have insufficient permissions/);
      await flows.closeFailedItemError();
      await flows.gotoInventory();
      await expect(inventoryPage.row(ITEM_NAME).getByText('Failed', { exact: true })).toBeVisible();
      await expect(inventoryPage.discoveredDetails(ITEM_NAME)).toHaveCount(0);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The instance is not discovered, but NBR keeps it listed as a Failed row until Cancel; the case says it is not added. The error is read through the row menu Show error (no pop-up).' });
    });
  },
);
