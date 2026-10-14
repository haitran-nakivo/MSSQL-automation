import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154613: "Verify Finish Initiates Connection".
// Lab preconditions: signed-in Director; the Read-Scale availability group target of .env (mssqlReadScaleTarget, today 10.10.33.141) is reachable and
//   its host is NOT already in Inventory under any name (the Director then answers "Duplicate entries are not allowed" and the test ends ABORTED);
//   no Inventory item named P07-154613.
// Inventory side effects: adds one Inventory item named "P07-154613" (installs or reuses the transporter on the host); the test waits for its
//   discovery to end and removes it (Remove host and keep transporter) afterwards. Nothing else is touched.
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is "Settings > Inventory", the "+" button and the "Application" tile.
// case-vs-ui: the case speaks of an instance name and an instance host; the standalone instance hosts are already in Inventory, so the free Read-Scale
//   target is used (owner decision): Type = Microsoft SQL Server Read-Scale availability group with its AG name.
// case-vs-ui: the connection itself is not visible; it is inferred from the outcome (the wizard closes, the row is added, discovery ends with "N hosts, N databases" and no Failed badge).
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P07-154613';
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
  'NAKIVO Add wizard connects to the SQL host and discovers its databases after Finish is clicked with valid credentials',
  { tag: '@NJM-154613' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);

    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Reachability of the SQL host cannot be checked from the UI; it is shown by the connection outcome in step 5.' });
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
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Enter the name and valid SQL credentials for the host; the fields accept the values', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Read-Scale availability group target is used instead of an instance (the instance hosts are already in Inventory); the form also needs the Hostname or IP and the OS credentials.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      await flows.fillAddForm({ displayName: ITEM_NAME, ...target });
      await expect.poll(async () => (await wizardFlows.fieldState('host')).value, { message: 'Hostname or IP does not hold the typed value' }).toBe(target.host);
      await expect.poll(async () => (await wizardFlows.fieldState('availabilityGroupName')).value, { message: 'AG name does not hold the typed value' }).toBe(target.agName);
      await expect.poll(async () => (await wizardFlows.fieldState('username', 1)).value, { message: 'SQL username does not hold the typed value' }).toBe(target.sqlUsername);
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('username', 1)).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('4. Click Finish; the Add wizard closes and the item is listed as being added', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The connection attempt is not shown by NBR; the wizard closing and the row "Adding..." are what is asserted.' });
      created.add(ITEM_NAME);
      const outcome = await flows.finishAdd();
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(addInventoryItemPage.title).toBeHidden();
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
    });

    await test.step('5. Observe the connection result; discovery completes with no connection error', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'A successful connection is inferred from the row ending with a database count and no Failed badge; the wizard itself does not proceed to a discovery step.' });
      expect(await flows.waitForDiscovery(ITEM_NAME, 600_000), 'discovery did not complete (Failed or no result in time)').toBe('discovered');
      await flows.gotoInventory();
      await expect(inventoryPage.row(ITEM_NAME).getByText('Failed', { exact: true })).toHaveCount(0);
    });
  },
);
