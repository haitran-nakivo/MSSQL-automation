import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154547: "[DBM-Inv-UI-Add-Options-0004] Verify Display Name Unicode Support".
// Lab preconditions: signed-in Director; the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in
//   Inventory under any name (the Director then answers "Duplicate entries are not allowed" and the test ends ABORTED); no Inventory item is named
//   like the Unicode test name. Today WS2022-SQL2025-19.145 (the host of mssqlInstanceTarget) is in Inventory: remove it first.
// Inventory side effects: adds one item with the Unicode Display name; the test waits for its discovery to end and removes it
//   (Remove host and keep transporter, or Cancel when the add Failed) afterwards. Only that name is touched.
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case data omits Instance name and the SQL credentials, which the form also requires; they are filled as well. Type = Microsoft SQL Server instance.
// case-vs-ui: the case gives no Unicode string; the test uses accented Latin and CJK characters within the 25-character limit.
test.use(RUN_OPTIONS);

const UNICODE_NAME = 'Tést-Ünï-日本語-QA';
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
  'NAKIVO Add wizard accepts a Unicode Display name and the Inventory lists the item under that name',
  { tag: '@NJM-154547' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    expect(UNICODE_NAME.length, 'the Display name must stay within 25 characters').toBeLessThanOrEqual(25);

    await test.step('1. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens at the Platform step', async () => {
      await flows.gotoInventory();
      // The name is an ordinary one: an existing item with it is not the test's own, so it is never touched.
      if (await flows.hasItem(UNICODE_NAME)) throw new Error(`ABORTED: an Inventory item named "${UNICODE_NAME}" already exists; remove it and run again`);
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

    await test.step('3. Enter a Unicode string into the Display name; the field shows it unchanged', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case data omits Instance name and the SQL credentials, which the form also requires; they are filled as well. Type = Microsoft SQL Server instance. The Unicode string (accented Latin and CJK) is chosen by the test.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await wizardFlows.enter('name', UNICODE_NAME);
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('instanceName', target.instanceName);
      await wizardFlows.enter('username', target.sqlUsername, 1);
      await wizardFlows.enter('password', target.sqlPassword, 1);
      await expect(addInventoryItemPage.input('name')).toHaveValue(UNICODE_NAME);
      await expect(addInventoryItemPage.input('name')).not.toHaveAttribute('aria-invalid', 'true');
    });

    await test.step('4. Click Finish; the item is accepted and the Unicode Display name is shown intact in the Inventory', async () => {
      const outcome = await flows.finishAdd();
      created.add(UNICODE_NAME);
      // A duplicate means the host is already in Inventory under another name, so the case cannot run (ABORTED), it did not fail.
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(UNICODE_NAME)).toBeVisible();
    });
  },
);
