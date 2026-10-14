import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154615: "[MSSQL-Inv-UI-Options-0027] Verify Release Version Check".
// Lab preconditions: signed-in Director; the Read-Scale availability group target of .env (mssqlReadScaleTarget, today 10.10.33.141, SQL Server 17.0.1000.7)
//   is reachable and its host is NOT already in Inventory under any name (the Director then answers "Duplicate entries are not allowed" and the test
//   ends ABORTED); no Inventory item named P07-154615.
// Inventory side effects: adds one Inventory item named "P07-154615" (installs or reuses the transporter on the host); the test waits for its
//   discovery to end and removes it (Remove host and keep transporter) afterwards. Nothing else is touched.
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is "Settings > Inventory", the "+" button and the "Application" tile.
// case-vs-ui: the case speaks of an instance; the instance hosts are already in Inventory, so the free Read-Scale target is used (owner decision).
// case-vs-ui: the version check is internal; only its outcome is observable: discovery proceeds and the item page shows a SQL version (build number).
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P07-154615';
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
  'NAKIVO Director accepts a supported Microsoft SQL Server version and lets discovery proceed, showing the SQL version on the item page',
  { tag: '@NJM-154615' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);

    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
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

    await test.step('3. Enter a valid name and valid SQL credentials; the fields accept the values', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Read-Scale availability group target is used instead of an instance (the instance hosts are already in Inventory).' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      await flows.fillAddForm({ displayName: ITEM_NAME, ...target });
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('availabilityGroupName')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('username', 1)).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('4. Click Finish and let the product connect; the add starts', async () => {
      created.add(ITEM_NAME);
      const outcome = await flows.finishAdd();
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
    });

    await test.step('5. Observe the outcome of the version check; a supported version lets discovery proceed and the SQL version is shown', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The check against the supported versions is internal and not shown; a supported version is inferred from discovery completing with no Failed badge and the item page showing a SQL version.' });
      expect(await flows.waitForDiscovery(ITEM_NAME, 600_000), 'discovery did not complete (Failed or no result in time)').toBe('discovered');
      await flows.openItem(ITEM_NAME);
      await expect
        .poll(async () => (await flows.readItemDetails()).sqlVersion, { message: 'the item page does not show a SQL version build number' })
        .toMatch(/\d+\.\d+\.\d+/);
    });
  },
);
