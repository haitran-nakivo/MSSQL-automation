import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../../flows/inventory.flows';
import { instanceItemName } from '../../../../../../helpers/item-names';
import { readOsPlatformInstanceTarget } from '../../../../../../helpers/credentials';
import { CaseCleanup } from '../../../../../../helpers/case-cleanup';

// NJM-154432: "Verify adding Windows 11 hosting SQL Server 2025" (description: "Verify discovery failed Win 11 hosting SQL 2025").
// Display name (owner format): AAG / RSAG / FCI-<last two octets of the host IP>, or WS<year>-SQL<year>-<last two octets> for a server instance, for example AAG-38.76 or WS2022-SQL2025-19.145 (helpers/item-names.ts). Variants: -e (renamed), -d (rejected duplicate).
// Lab preconditions: a Windows 11 (client OS) host with SQL Server 2025 as a standalone instance, reachable from the Director. Its values are the .env group
//   NAKIVO_OSP_NJM154432_* (HOST, OS_USERNAME, OS_PASSWORD, INSTANCE_NAME, SQL_USERNAME, SQL_PASSWORD); saved in .env on 2026-10-12; the test ends
//   ABORTED ("Missing in .env"). The host must NOT be in Inventory under any name (duplicate = ABORTED); no item named <name>.
// Inventory side effects: the add is expected to be rejected, so normally nothing stays; if a Failed row is created it is shown, read and cancelled (Cancel deletes it).
//   afterEach discards anything left. No transporter is installed when the add is rejected before the agent install (not verified).
// case-vs-ui (steps 2-3): "Configuration > Inventory > Add New > Application/Database" is Settings > Inventory, the "+" button, the Application tile and the Type list.
// case-vs-ui (step 3): the case expects the message "Cannot add the Microsoft SQL Server instance. The Operating System installed on this server is not supported by the
//   current version of the product." The UI reports a failed add either in the wizard (it stays open) or as a Failed row whose "Show error" dialog carries the text; which
//   one happens for a client OS was not observed, so both are accepted and the one seen is recorded as the "observed-outcome" annotation.
// Ad hoc (beyond the case): a Failed row is removed with its row menu Cancel and the Inventory item count returns to its starting value.
test.use(RUN_OPTIONS);

const NOT_SUPPORTED = /Operating System installed on this server is not supported/i;

let cleanup: CaseCleanup | undefined;

// Returns Inventory, Nodes and the host to the state before the case if it stopped early (the original failure is what the report shows).
test.afterEach(async () => {
  const current = cleanup;
  cleanup = undefined;
  await current?.dispose();
});

test(
  'NAKIVO rejects adding a Microsoft SQL Server instance on a Windows 11 host with a message that the operating system is not supported',
  { tag: '@NJM-154432' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, removeHostFlows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
    test.setTimeout(1_800_000); // the case plus its cleanup (uninstall, and an add-back when a node or transporter is left)
    const target = readOsPlatformInstanceTarget('NJM-154432');
    const displayName = instanceItemName('Win11', 'SQL2025', target.host);
    let itemCountBefore = 0;

    const cc = (cleanup = new CaseCleanup(flows, removeHostFlows, target, testInfo, [displayName]));

    await test.step('1. Precondition: Director is accessible and the Windows 11 / SQL Server 2025 host is not in the Inventory', async () => {
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

    await test.step('3. Enter the host and SQL credentials and add the item: the operating system is reported as not supported', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      cc.track(displayName);
      if (outcome === 'added') {
        // The wizard closed: the add started and must end as a Failed row that explains why.
        await expect(inventoryPage.item(displayName)).toBeVisible();
        expect(await flows.waitForDiscovery(displayName, 600_000), 'the add did not end as Failed').toBe('failed');
        const error = await flows.showFailedItemError(displayName);
        testInfo.annotations.push({ type: 'observed-outcome', description: 'Failed row; Show error text: ' + error.slice(0, 300) });
        expect(error).toMatch(NOT_SUPPORTED);
        await flows.closeFailedItemError();
      } else {
        // The wizard stayed open: the rejection is shown in the wizard.
        testInfo.annotations.push({ type: 'observed-outcome', description: 'The wizard stayed open with a message.' });
        await expect(addInventoryItemPage.message(NOT_SUPPORTED)).toBeVisible();
        await wizardFlows.leave();
      }
    });

    await test.step('Ad hoc (observation, not asserted): what the add attempt left in Settings > Nodes and on the host', () => cc.recordHostState('after the add attempt'));

    await test.step('Ad hoc: no usable item is left; a Failed row is cancelled and the item count returns to its starting value', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        expect(await flows.cancelFailedItem(displayName), 'Cancel did not remove the Failed row').toBe(true);
        await flows.gotoInventory();
        await expect.poll(() => flows.hasItem(displayName), { timeout: 60_000, message: 'the cancelled Failed row is still listed' }).toBe(false);
      }
      expect(await inventoryPage.itemCount()).toBe(itemCountBefore);
    });

    await test.step('Cleanup (not part of the case): the items of this case are removed with "uninstall transporter" and no item, node or transporter is left', () => cc.finish());
  },
);
