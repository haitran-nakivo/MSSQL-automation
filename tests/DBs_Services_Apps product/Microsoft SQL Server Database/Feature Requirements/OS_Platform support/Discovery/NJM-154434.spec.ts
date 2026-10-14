import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../../flows/inventory.flows';
import { instanceItemName } from '../../../../../../helpers/item-names';
import { readOsPlatformInstanceTarget } from '../../../../../../helpers/credentials';
import { CaseCleanup } from '../../../../../../helpers/case-cleanup';

// NJM-154434: "Verify adding Windows Server 2019 hosting SQL Server 2014" (description: "Verify discovery failed Win 2019 hosting SQL 2014").
// Display name (owner format): AAG / RSAG / FCI-<last two octets of the host IP>, or WS<year>-SQL<year>-<last two octets> for a server instance, for example AAG-38.76 or WS2022-SQL2025-19.145 (helpers/item-names.ts). Variants: -e (renamed), -d (rejected duplicate).
// Lab preconditions: a Windows Server 2019 host with SQL Server 2014 as a standalone instance, reachable from the Director. Its values are the .env group
//   NAKIVO_OSP_NJM154434_* (HOST, OS_USERNAME, OS_PASSWORD, INSTANCE_NAME, SQL_USERNAME, SQL_PASSWORD); the owner supplies it later, until then the test ends
//   ABORTED ("Missing in .env"). The host must NOT be in Inventory under any name (duplicate = ABORTED); no item named <name> or <name>-d.
// Inventory side effects: adds <name> (the ad hoc duplicate add is rejected and creates nothing); afterEach removes it (Remove with "keep transporter", or Cancel for a
//   Failed row).
// case-vs-ui (steps 2-5): "Configuration > Inventory > Add New > Application/Database" is Settings > Inventory, the "+" button, the Application tile and the Type list.
// case-vs-ui (open): the steps expect the SQL Server 2014 instance to be added, connected and healthy, while the description says "discovery failed". The expectation asserted is the
//   steps' (success). This product version's support for SQL Server 2014 was not inspected: if NBR rejects it, the Failed row's Show error text is attached as the
//   "observed-outcome" annotation and the test fails, for the owner to reconcile the case with the UI.
// Ad hoc (beyond the case): the same host added again is rejected as a duplicate and creates no second item.
test.use(RUN_OPTIONS);

let cleanup: CaseCleanup | undefined;

// Returns Inventory, Nodes and the host to the state before the case if it stopped early (the original failure is what the report shows).
test.afterEach(async () => {
  const current = cleanup;
  cleanup = undefined;
  await current?.dispose();
});

test(
  'NAKIVO user can add a Microsoft SQL Server instance on Windows Server 2019 hosting SQL Server 2014 and its databases are discovered',
  { tag: '@NJM-154434' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, removeHostFlows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
    test.setTimeout(2_100_000); // the case plus its cleanup (uninstall, and an add-back when a node or transporter is left)
    const target = readOsPlatformInstanceTarget('NJM-154434');
    const displayName = instanceItemName('WS2019', 'SQL2014', target.host);
    const duplicateName = `${displayName}-d`;
    let itemCountBefore = 0;

    const cc = (cleanup = new CaseCleanup(flows, removeHostFlows, target, testInfo, [displayName, duplicateName]));

    await test.step('1. Precondition: Director is accessible and the SQL Server 2014 host is not in the Inventory', async () => {
      await cc.requireNoForeignTransporter(); // a node or transporter this case did not create ends it ABORTED, untouched
      await flows.gotoInventory();
      for (const name of [displayName, duplicateName]) {
        if (await flows.hasItem(name)) throw new Error(`ABORTED: an Inventory item named "${name}" already exists; remove it and run again`);
      }
      itemCountBefore = await inventoryPage.itemCount();
    });

    await test.step('2. Open Settings > Inventory > + and choose Application, then the standalone instance type: the Options step is shown', async () => {
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
    });

    await test.step('3. Enter the host and SQL credentials and add the item: the SQL Server 2014 instance is added', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      cc.track(displayName);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
    });

    await test.step('4. Verify database discovery for the added SQL host: the databases are discovered and listed', async () => {
      const discovery = await flows.waitForDiscovery(displayName, 600_000);
      if (discovery === 'failed') {
        const error = await flows.showFailedItemError(displayName);
        testInfo.annotations.push({ type: 'observed-outcome', description: 'Failed row; Show error text: ' + error.slice(0, 300) });
        await flows.closeFailedItemError();
      }
      expect(discovery, 'discovery of the SQL Server 2014 instance did not complete').toBe('discovered');
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered SQL Server 2014 instance' })
        .toMatchObject({ type: ITEM_TYPES.instance, instanceName: target.instanceName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/) });
      const details = await flows.readItemDetails();
      expect(details.sqlVersion.startsWith('12.'), `SQL version "${details.sqlVersion}" is not a SQL Server 2014 build`).toBe(true);
      expect(details.os, 'the item page does not show the host operating system').toContain('Windows Server 2019');
    });

    await test.step('5. Verify the added item state in the Inventory list: it appears with a healthy, connected state', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible();
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
      await flows.openItem(displayName);
      await expect(flows.readItemDetails()).resolves.toMatchObject({ noIssues: true });
    });

    await test.step('Ad hoc (negative): adding the same host again is rejected as a duplicate and creates no second item', async () => {
      await flows.gotoInventory();
      await flows.startAdd(ITEM_TYPES.instance);
      const again = await flows.submitAdd({ ...target, displayName: duplicateName });
      cc.track(duplicateName);
      expect(again, 'the Director accepted a second item for the same host').toBe('duplicate');
      await expect(addInventoryItemPage.message(/Duplicate entries are not allowed/)).toBeVisible();
      await wizardFlows.leave();
      await flows.gotoInventory();
      expect(await flows.hasItem(duplicateName)).toBe(false);
      expect(await inventoryPage.itemCount()).toBe(itemCountBefore + 1);
    });

    await test.step('Cleanup (not part of the case): the items of this case are removed with "uninstall transporter" and no item, node or transporter is left', () => cc.finish());
  },
);
