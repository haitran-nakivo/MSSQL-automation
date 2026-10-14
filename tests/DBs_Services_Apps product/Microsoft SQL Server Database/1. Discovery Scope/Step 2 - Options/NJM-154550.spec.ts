import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154550: "[DBM-Inv-UI-Add-Options-0007] Verify Display Name Auto-Fill".
// Lab preconditions: signed-in Director; the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in
//   Inventory under any name (the Director then answers "Duplicate entries are not allowed" and the test ends ABORTED); no Inventory item is named
//   after the host. Today WS2022-SQL2025-19.145 (the host of mssqlInstanceTarget) is in Inventory: remove it first.
// Inventory side effects: adds one item named after the host (the Display name is left empty); the test waits for its discovery to end and removes it
//   (Remove host and keep transporter, or Cancel when the add Failed) afterwards. Only the item named after the host that the test added is touched.
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case expects the Display name field to be auto-filled in the wizard as the host is typed. The Display name is filled on save: the
//   Inventory row is named after the Hostname or IP. The test asserts the row name; a live fill in the wizard field is not asserted.
// case-vs-ui: the case data omits Instance name and the SQL credentials, which the form also requires; they are filled as well. Type = Microsoft SQL Server instance.
test.use(RUN_OPTIONS);

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
  'NAKIVO Inventory names a new item after its Hostname or IP when the Display name is left empty',
  { tag: '@NJM-154550' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    expect(target.host.length, 'the host must fit the 25-character Display name').toBeLessThanOrEqual(25);

    await test.step('1. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens at the Platform step', async () => {
      await flows.gotoInventory();
      // The item will be named after the host: an existing item with that name is not the test's own, so it is never touched.
      if (await flows.hasItem(target.host)) throw new Error(`ABORTED: an Inventory item named "${target.host}" already exists; remove it and run again`);
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

    await test.step('3. Enter the Hostname or IP and leave the Display name empty; on save the Inventory item takes the host as its name', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects the Display name field to be auto-filled in the wizard; the current UI fills the name on save (the Inventory row is named after the Hostname or IP). A live fill in the wizard field is not asserted. The case data omits Instance name and the SQL credentials, which the form also requires; they are filled as well. Type = Microsoft SQL Server instance.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('instanceName', target.instanceName);
      await wizardFlows.enter('username', target.sqlUsername, 1);
      await wizardFlows.enter('password', target.sqlPassword, 1);
      const outcome = await flows.finishAdd();
      created.add(target.host);
      // A duplicate means the host is already in Inventory under another name, so the case cannot run (ABORTED), it did not fail.
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(target.host), 'the new Inventory item is not named after the Hostname or IP').toBeVisible();
    });
  },
);
