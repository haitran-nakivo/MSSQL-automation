import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../../flows/inventory.flows';
import { instanceItemName } from '../../../../../../helpers/item-names';
import { readOsPlatformInstanceTarget } from '../../../../../../helpers/credentials';
import { CaseCleanup } from '../../../../../../helpers/case-cleanup';

// NJM-154436: "Verify adding Windows 8 hosting SQL Server 2008 R2" (description: "Verify discovery failed Win 8 hosting SQL 2008 R2").
// Display name (owner format): AAG / RSAG / FCI-<last two octets of the host IP>, or WS<year>-SQL<year>-<last two octets> for a server instance, for example AAG-38.76 or WS2022-SQL2025-19.145 (helpers/item-names.ts). Variants: -e (renamed), -d (rejected duplicate).
// Lab preconditions: a Windows 8 host with SQL Server 2008 R2 as a standalone instance, reachable from the Director. Its values are the .env group
//   NAKIVO_OSP_NJM154436_* (HOST, OS_USERNAME, OS_PASSWORD, INSTANCE_NAME, SQL_USERNAME, SQL_PASSWORD); saved in .env on 2026-10-12; the test ends
//   ABORTED ("Missing in .env"). The host must NOT be in Inventory under any name (duplicate = ABORTED); no item named <name>.
// Inventory side effects: the add is attempted; whatever the Director creates (an item, or a Failed row) is removed in the last step and by afterEach.
// case-vs-ui (steps 2-3): "Configuration > Inventory > Add New > Application/Database" is Settings > Inventory, the "+" button, the Application tile and the Type list.
// case-vs-ui (steps 4-5): the case only says the outcome must be "consistent with its support policy" (SQL Server 2008 R2 is a legacy, unsupported version) and that the Inventory
//   state must match that outcome. The outcome of an unsupported version was not observed, so the test accepts the three outcomes the UI can show and checks the Inventory is
//   consistent with the one seen, which is attached as the "observed-outcome" annotation:
//   - the wizard stays open with an error message (nothing is added);
//   - the row ends Failed, with a non-empty "Show error" text;
//   - the item is added and discovered (the version is then supported).
//   This is deliberate: an exact expectation would be invented. Tighten it after the first real run shows the behavior.
// Ad hoc (beyond the case): whatever was created is removed (Failed row: Cancel; item: Remove with "keep transporter") and the item count returns to its starting value.
test.use(RUN_OPTIONS);

let cleanup: CaseCleanup | undefined;

// Returns Inventory, Nodes and the host to the state before the case if it stopped early (the original failure is what the report shows).
test.afterEach(async () => {
  const current = cleanup;
  cleanup = undefined;
  await current?.dispose();
});

test(
  'NAKIVO reports an outcome for adding a Microsoft SQL Server 2008 R2 instance on Windows 8 that matches the Inventory state',
  { tag: '@NJM-154436' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, removeHostFlows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
    test.setTimeout(2_100_000); // the case plus its cleanup (uninstall, and an add-back when a node or transporter is left)
    const target = readOsPlatformInstanceTarget('NJM-154436');
    const displayName = instanceItemName('Win8', 'SQL2008R2', target.host);
    let itemCountBefore = 0;
    let observed: 'wizard-message' | 'failed' | 'discovered' = 'wizard-message';

    const cc = (cleanup = new CaseCleanup(flows, removeHostFlows, target, testInfo, [displayName]));

    await test.step('1. Precondition: Director is accessible and the SQL Server 2008 R2 host is not in the Inventory', async () => {
      await cc.requireNoForeignTransporter(); // a node or transporter this case did not create ends it ABORTED, untouched
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      itemCountBefore = await inventoryPage.itemCount();
    });

    await test.step('2. Open Settings > Inventory > + and choose Application, then the standalone instance type: the Options step is shown', async () => {
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
    });

    await test.step('3. Enter the host and SQL credentials and attempt to add the item: the add attempt is processed', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      cc.track(displayName);
      if (outcome === 'added') {
        await expect(inventoryPage.item(displayName)).toBeVisible();
      } else {
        // The wizard is still open: some error text must be on screen.
        const messageShown = await addInventoryItemPage.message(/\S/).first().isVisible();
        expect(messageShown, 'the wizard stayed open without any message').toBe(true);
      }
      observed = outcome === 'added' ? 'discovered' : 'wizard-message';
    });

    await test.step('Ad hoc (observation, not asserted): what the add attempt left in Settings > Nodes and on the host', () => cc.recordHostState('after the add attempt'));

    await test.step('4. Verify the discovery result for the SQL Server 2008 R2 host: the outcome is reported', async () => {
      if (observed === 'wizard-message') {
        await wizardFlows.leave();
        return;
      }
      const discovery = await flows.waitForDiscovery(displayName, 600_000);
      expect(['discovered', 'failed'], 'discovery neither completed nor failed').toContain(discovery);
      observed = discovery === 'failed' ? 'failed' : 'discovered';
      if (observed === 'failed') {
        const error = await flows.showFailedItemError(displayName);
        expect(error.trim(), 'the Failed row has no error text').not.toBe('');
        testInfo.annotations.push({ type: 'observed-outcome', description: 'Failed row; Show error text: ' + error.slice(0, 300) });
        await flows.closeFailedItemError();
      }
    });

    await test.step('5. Verify the item state in the Inventory list: it is consistent with the reported outcome', async () => {
      testInfo.annotations.push({ type: 'observed-outcome', description: 'Outcome seen: ' + observed });
      await flows.gotoInventory();
      if (observed === 'wizard-message') {
        expect(await flows.hasItem(displayName), 'an item was listed although the wizard rejected the add').toBe(false);
      } else if (observed === 'failed') {
        expect(await flows.hasItem(displayName)).toBe(true);
        await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeVisible();
      } else {
        await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
        await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
      }
    });

    await test.step('Ad hoc: whatever was created is removed and the item count returns to its starting value', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        const removed = await flows.discardIfPresent(displayName);
        expect(removed, 'the created item or Failed row could not be removed').toBe(true);
        await flows.gotoInventory();
        await expect.poll(() => flows.hasItem(displayName), { timeout: 120_000, message: 'the removed item is still listed' }).toBe(false);
      }
      expect(await inventoryPage.itemCount()).toBe(itemCountBefore);
    });

    await test.step('Cleanup (not part of the case): the items of this case are removed with "uninstall transporter" and no item, node or transporter is left', () => cc.finish());
  },
);
