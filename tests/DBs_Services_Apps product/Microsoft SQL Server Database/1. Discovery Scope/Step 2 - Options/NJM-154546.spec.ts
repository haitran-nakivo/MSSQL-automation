import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154546: "[DBM-Inv-UI-Add-Options-0003] Verify Display Name Optionality".
// Lab preconditions: signed-in Director; the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in
//   Inventory under any name (the Director then answers "Duplicate entries are not allowed" and the test ends ABORTED); no Inventory item is named
//   after the host. Today WS2022-SQL2025-19.145 (the host of mssqlInstanceTarget) is in Inventory: remove it first.
// Inventory side effects: adds one item (named after the host, because the Display name is empty); the test waits for its discovery to end and
//   removes it (Remove host and keep transporter, or Cancel when the add Failed) afterwards. Only the item named after the host that the test added is touched.
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case data omits Instance name and the SQL credentials, which the form also requires; they are filled as well. Type = Microsoft SQL Server instance.
// case-vs-ui: the UI shows no red asterisk; a required field is shown by a red border with aria-invalid="true" after it is left empty or after Finish, and the Display name is never flagged.
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
  'NAKIVO Add wizard accepts an empty Display name and starts adding the item',
  { tag: '@NJM-154546' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);

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

    await test.step('3. Leave the Display name empty and fill the other values; the Display name shows no required indicator', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case data omits Instance name and the SQL credentials, which the form also requires; they are filled as well. Type = Microsoft SQL Server instance. The UI has no red asterisk: "no required indicator" is asserted as no aria-invalid="true" on the Display name after it is left empty.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await wizardFlows.touch('name');
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('instanceName', target.instanceName);
      await wizardFlows.enter('username', target.sqlUsername, 1);
      await wizardFlows.enter('password', target.sqlPassword, 1);
      await expect(addInventoryItemPage.input('name')).toHaveValue('');
      await expect(addInventoryItemPage.input('name')).not.toHaveAttribute('aria-invalid', 'true');
    });

    await test.step('4. Click Finish with the Display name empty; no validation error is raised and the wizard closes', async () => {
      const outcome = await flows.finishAdd();
      // The item takes the host as its name (Observed); cleanup tries that name only once the add started.
      created.add(target.host);
      // A duplicate means the host is already in Inventory under another name, so the case cannot run (ABORTED), it did not fail.
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish with an empty Display name').toBe('added');
      await expect(addInventoryItemPage.title).toBeHidden();
    });
  },
);
