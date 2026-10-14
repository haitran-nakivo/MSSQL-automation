import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154617: "[MSSQL-Inv-UI-Options-0030-1] Verify Unsupported Old Version Message - Microsoft SQL Server instance".
// Lab preconditions: the too-old standalone instance target (mssqlOldInstanceTarget: .env NAKIVO_MSSQL_OLD_INSTANCE_*, a SQL Server older than the
//   supported 2016-2025, reachable from the Director) exists; it does not exist in the lab today, so the test aborts with "Missing in .env" until the owner
//   adds it. Its host must NOT already be in Inventory; no Inventory item named P07-154617.
// Inventory side effects: adds one item named P07-154617 that must end as a Failed row; afterEach cancels it (Failed row > Cancel).
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is "Settings > Inventory", the "+" button, the "Application" tile and the Type "Microsoft SQL Server instance".
// case-vs-ui: where NBR 11.2.1 shows the message is not observed; it is read where other failed adds show their error: the Failed row menu > Show error.
// case-vs-ui: the case gives no wording; the spec text ("... has an unsupported version", "Only Microsoft SQL Server instances from version ... are supported") is not
//   asserted verbatim: the text must say the version is unsupported / not supported, and the full text is attached as evidence.
test.use(RUN_OPTIONS);

const ITEM_NAME = 'P07-154617';
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
  'NAKIVO Director shows a message that the Microsoft SQL Server version is not supported when an old instance is added',
  { tag: '@NJM-154617' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlOldInstanceTarget: target }, testInfo) => {
    test.setTimeout(900_000);

    await test.step('1. Precondition: an unsupported old Microsoft SQL Server host is reachable and Director is up', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Reachability of the old SQL host cannot be checked from the UI; the target values come from .env.' });
      await flows.gotoInventory();
      if (await flows.hasItem(ITEM_NAME)) throw new Error(`ABORTED: an Inventory item named "${ITEM_NAME}" already exists; remove it and run again`);
    });

    await test.step('2. Open Add, choose Application (Microsoft SQL Server) and the instance type; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile. startAdd opens the wizard and sets the Type in one call.' });
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
    });

    await test.step('3. Enter the instance name and valid credentials and click Finish; the version check runs and the add ends as Failed', async () => {
      await flows.fillAddForm({ displayName: ITEM_NAME, ...target });
      const outcome = await flows.finishAdd();
      created.add(ITEM_NAME);
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(ITEM_NAME)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The version check is internal; the detection shows as the row ending as Failed.' });
      expect(await flows.waitForDiscovery(ITEM_NAME, 600_000), 'the add of the unsupported old version did not end as Failed').toBe('failed');
    });

    await test.step('4. Read the message shown for the old version; it states that the detected version is not supported', async () => {
      const text = await flows.showFailedItemError(ITEM_NAME);
      await testInfo.attach('unsupported-version-error-text', { body: text, contentType: 'text/plain' });
      expect(text).toMatch(/unsupported|not supported/i);
      await flows.closeFailedItemError();
    });
  },
);
