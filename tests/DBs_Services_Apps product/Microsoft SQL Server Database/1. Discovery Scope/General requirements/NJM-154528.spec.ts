import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';

// NJM-154528: "Verify adding Read-Scale AG to Inventory (Ref: MSSQL-Inv-General-0004)".
// Lab preconditions: the Read-Scale AG target of .env (mssqlReadScaleTarget, host 10.10.33.141, AG ReadScaleAG) is reachable and its host is NOT
//   already in Inventory under any name (the Director then answers with the duplicate message and the test ends ABORTED); no item named P02-154528.
// Inventory side effects: adds one item named P02-154528; afterEach removes it (keep transporter) if it is still there.
// case-vs-ui (step 1): the UI cannot show the license or reachability; only a signed-in Director and the Inventory page are checked.
// case-vs-ui (steps 2-3): the Add wizard is opened with Settings > Inventory > + and Application is chosen; the type is set in the Options step
//   (one UI action covers case steps 2 and 3).
// case-vs-ui (step 4): the form has no instance field: Hostname or IP is the SQL Server hosting the primary replica, plus the clusterless AG name.
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
  'NAKIVO user can add a Microsoft SQL Server Read-Scale availability group to Inventory and see its discovered databases',
  { tag: '@NJM-154528' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, wizardFlows, inventoryPage, addInventoryItemPage, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'P02-154528';
    const form = { displayName, ...target };

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
    });

    await test.step('2. Open the Add wizard and choose Application', async () => {
      await flows.startAdd(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('3. Choose Microsoft SQL Server (Read-Scale availability group): the form shows the host and credential fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.readScale);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
    });

    await test.step('4. Enter the host, AG name and credentials: they are accepted without a validation error', async () => {
      await flows.fillAddForm(form);
      await expect.poll(() => wizardFlows.fieldState('host'), { message: 'Hostname or IP is not accepted' }).toMatchObject({ value: target.host, invalid: false });
      await expect.poll(() => wizardFlows.fieldState('availabilityGroupName'), { message: 'AG name is not accepted' }).toMatchObject({ value: target.agName, invalid: false });
      await expect.poll(() => wizardFlows.fieldState('username', 0), { message: 'OS username is not accepted' }).toMatchObject({ value: target.osUsername, invalid: false });
      await expect.poll(() => wizardFlows.fieldState('username', 1), { message: 'SQL username is not accepted' }).toMatchObject({ value: target.sqlUsername, invalid: false });
    });

    await test.step('5. Finish: discovery of the Read-Scale AG completes without a connection or credential error', async () => {
      const outcome = await flows.finishAdd();
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the Read-Scale AG did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
    });

    await test.step('6. The Read-Scale AG is listed in Inventory as a Read-Scale availability group item', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.item(displayName)).toBeVisible();
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show a Read-Scale availability group' })
        .toMatchObject({ type: ITEM_TYPES.readScale, agName: target.agName });
    });

    await test.step('7. The discovered databases of the Read-Scale AG are listed', async () => {
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not list the discovered databases' })
        .toMatchObject({ totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154528 steps 6-7: the item type and databases are read on the item page ("Total databases"); the UI has no tree to expand.' });
    });
  },
);
