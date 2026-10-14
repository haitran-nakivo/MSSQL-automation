import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../../flows/inventory.flows';
import { instanceItemName } from '../../../../../../helpers/item-names';
import { readOsPlatformInstanceTarget } from '../../../../../../helpers/credentials';
import { CaseCleanup } from '../../../../../../helpers/case-cleanup';

// NJM-154435: "Verify editing Windows Server 2016 hosting SQL Server 2012" (description: "Verify discovery failed Win 2016 hosting SQL 2012").
// Display name (owner format): AAG / RSAG / FCI-<last two octets of the host IP>, or WS<year>-SQL<year>-<last two octets> for a server instance, for example AAG-38.76 or WS2022-SQL2025-19.145 (helpers/item-names.ts). Variants: -e (renamed), -d (rejected duplicate).
// Lab preconditions: a Windows Server 2016 host with SQL Server 2012 as a standalone instance, reachable from the Director. Its values are the .env group
//   NAKIVO_OSP_NJM154435_* (HOST, OS_USERNAME, OS_PASSWORD, INSTANCE_NAME, SQL_USERNAME, SQL_PASSWORD); saved in .env on 2026-10-12; the test ends
//   ABORTED ("Missing in .env"). The host must NOT be in Inventory under any name (duplicate = ABORTED); no item named <name> or <name>-e.
// Inventory side effects: the test adds the item itself (the case assumes it already exists), renames it to <name>-e, then removes it with "keep transporter";
//   afterEach discards what is left.
// case-vs-ui (step 1): the case expects the Windows Server 2016 item "present in the Inventory with a connected state", while its description says "discovery failed".
//   If the add ends Failed the precondition is unmet and the test ends ABORTED (not FAIL), with the Show error text in the message; the contradiction between the title and the description
//   is for the owner to resolve.
// case-vs-ui (steps 2-5): "select the item and click Manage/Edit" is the Edit button of the item page; "change the credentials/connection settings" changes the Display name
//   (the lab has one valid credential pair); Save closes the wizard and the item is rediscovered. The form's other fields are checked as pre-populated.
// Ad hoc (beyond the case): Cancel on Edit asks for confirmation and Close discards the change.
test.use(RUN_OPTIONS);

let cleanup: CaseCleanup | undefined;

// Returns Inventory, Nodes and the host to the state before the case if it stopped early (the original failure is what the report shows).
test.afterEach(async () => {
  const current = cleanup;
  cleanup = undefined;
  await current?.dispose();
});

test(
  'NAKIVO user can edit a Microsoft SQL Server instance item on a Windows Server 2016 host hosting SQL Server 2012 and it is rediscovered',
  { tag: '@NJM-154435' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, removeHostFlows, inventoryPage, editInventoryItemPage, wizardFlows }, testInfo) => {
    test.setTimeout(2_700_000); // the case plus its cleanup (uninstall, and an add-back when a node or transporter is left)
    const target = readOsPlatformInstanceTarget('NJM-154435');
    const displayName = instanceItemName('WS2016', 'SQL2012', target.host);
    const editedName = `${displayName}-e`;

    const cc = (cleanup = new CaseCleanup(flows, removeHostFlows, target, testInfo, [displayName, editedName]));

    await test.step('1. Precondition: the Windows Server 2016 / SQL Server 2012 item is in the Inventory with a connected state', async () => {
      await cc.requireNoForeignTransporter(); // a node or transporter this case did not create ends it ABORTED, untouched
      await flows.gotoInventory();
      for (const name of [displayName, editedName]) {
        if (await flows.hasItem(name)) throw new Error(`ABORTED: an Inventory item named "${name}" already exists; remove it and run again`);
      }
      await flows.startAdd(ITEM_TYPES.instance);
      const outcome = await flows.submitAdd({ displayName, ...target });
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      cc.track(displayName);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      const discovery = await flows.waitForDiscovery(displayName, 600_000);
      if (discovery === 'failed') {
        const error = await flows.showFailedItemError(displayName);
        throw new Error(`ABORTED: the Windows Server 2016 / SQL Server 2012 host could not be added (it ends Failed), so there is no item to edit. Show error: ${error.slice(0, 300)}`);
      }
      expect(discovery, 'discovery did not complete').toBe('discovered');
      await expect(inventoryPage.item(displayName)).toBeVisible();
    });

    await test.step('2. Select the item and click Edit: the dialog opens pre-populated with the current host and credential settings', async () => {
      await flows.openItem(displayName);
      await flows.openEditForm();
      expect((await wizardFlows.fieldState('name')).value).toBe(displayName);
      expect((await wizardFlows.fieldState('host')).value).toBe(target.host);
      expect((await wizardFlows.fieldState('instanceName')).value).toBe(target.instanceName);
      expect((await wizardFlows.fieldState('type')).disabled).toBe(true);
    });

    await test.step('Ad hoc (negative): Cancel on Edit asks for confirmation and Close discards the change', async () => {
      await editInventoryItemPage.setDisplayName(editedName);
      await wizardFlows.cancel();
      await expect(wizardFlows.closePrompt).toBeVisible();
      await wizardFlows.confirmClose();
      await flows.gotoInventory();
      expect(await flows.hasItem(editedName)).toBe(false);
      expect(await flows.hasItem(displayName)).toBe(true);
    });

    await test.step('3. Change the connection settings in the edit dialog: the new values are accepted', async () => {
      await flows.openItem(displayName);
      await flows.openEditForm();
      await editInventoryItemPage.setDisplayName(editedName);
      await expect(editInventoryItemPage.field('displayName')).toHaveValue(editedName);
      await expect(editInventoryItemPage.field('displayName')).not.toHaveAttribute('aria-invalid', 'true');
    });

    await test.step('4. Save the edit: the changes are saved and the item reconnects', async () => {
      await editInventoryItemPage.save();
      await expect(editInventoryItemPage.displayNameField).toBeHidden({ timeout: 30_000 });
      await flows.gotoInventory();
      await expect(inventoryPage.item(editedName)).toBeVisible();
      await expect(inventoryPage.item(displayName)).toHaveCount(0);
    });

    await test.step('5. Verify database rediscovery after the edit: the databases are rediscovered and listed', async () => {
      cc.track(editedName);
      expect(await flows.waitForDiscovery(editedName, 300_000), 'rediscovery after the edit did not complete').toBe('discovered');
      await expect(inventoryPage.row(editedName).getByText('Failed', { exact: true })).toBeHidden();
      await flows.openItem(editedName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the rediscovered item' })
        .toMatchObject({ type: ITEM_TYPES.instance, instanceName: target.instanceName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
    });

    await test.step('Cleanup (not part of the case): the items of this case are removed with "uninstall transporter" and no item, node or transporter is left', () => cc.finish());
  },
);
