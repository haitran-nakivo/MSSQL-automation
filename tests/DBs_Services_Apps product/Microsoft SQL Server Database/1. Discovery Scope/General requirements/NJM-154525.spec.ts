import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154525: "Verify adding SQL Server Instance to Inventory (Ref: MSSQL-Inv-General-0001)".
// Lab preconditions: the standalone instance target of .env (mssqlInstanceTarget) is reachable and its host is NOT already in Inventory under
//   any name (the Director then answers with the duplicate message and the test ends ABORTED); no Inventory item named P02-154525.
//   Today WS2022-SQL2025-19.145 (the host of mssqlInstanceTarget) is in Inventory: remove it first.
// Inventory side effects: adds one item named P02-154525; afterEach removes it (keep transporter) if it is still there.
// case-vs-ui (step 1): the UI cannot show the license or reachability; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 2-3): the Add wizard is opened with Settings > Inventory > + and Application is chosen; the type is set in the Options step
//   (one UI action covers case steps 2 and 3); the type is called "Microsoft SQL Server instance".
// case-vs-ui (step 4): the form has Hostname or IP and Instance name as separate fields; OS and SQL credentials are separate pairs.
// case-vs-ui (steps 6-7): the Inventory row and the item page show the type and database count; the databases are listed on the item page,
//   there is no tree to expand.
test.use(RUN_OPTIONS);

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
  'NAKIVO user can add a Microsoft SQL Server instance to Inventory and see its discovered databases',
  { tag: '@NJM-154525' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, wizardFlows, inventoryPage, addInventoryItemPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'P02-154525';
    const form = { displayName, ...target };

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
    });

    await test.step('2. Open the Add wizard and choose Application', async () => {
      await flows.startAdd(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Choose Microsoft SQL Server (instance): the form shows the host and credential fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
    });

    await test.step('4. Enter the host, instance name and credentials: they are accepted without a validation error', async () => {
      await flows.fillAddForm(form);
      await expect.poll(() => wizardFlows.fieldState('host'), { message: 'Hostname or IP is not accepted' }).toMatchObject({ value: target.host, invalid: false });
      await expect.poll(() => wizardFlows.fieldState('instanceName'), { message: 'Instance name is not accepted' }).toMatchObject({ value: target.instanceName, invalid: false });
      await expect.poll(() => wizardFlows.fieldState('username', 0), { message: 'OS username is not accepted' }).toMatchObject({ value: target.osUsername, invalid: false });
      await expect.poll(() => wizardFlows.fieldState('username', 1), { message: 'SQL username is not accepted' }).toMatchObject({ value: target.sqlUsername, invalid: false });
    });

    await test.step('5. Finish: discovery of the instance completes without a connection or credential error', async () => {
      const outcome = await flows.finishAdd();
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the instance did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
    });

    await test.step('6. The instance is listed in Inventory as a Microsoft SQL Server instance item', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show a Microsoft SQL Server instance' })
        .toMatchObject({ type: ITEM_TYPES.instance, instanceName: target.instanceName });
    });

    await test.step('7. The discovered databases of the instance are listed', async () => {
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not list the discovered databases' })
        .toMatchObject({ totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154525 steps 6-7: the item type and databases are read on the item page ("Total databases"); the UI has no tree to expand and no "Standalone" wording.' });
    });
  },
);
