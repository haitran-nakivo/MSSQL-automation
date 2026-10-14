import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-157709: "Verify reuse of existing agent on Always On AG (Ref: MSSQL-Disc-0002-3)".
// Lab preconditions: the Always On availability group target of .env (mssqlAgTarget) is reachable and its host is NOT already in Inventory under any
//   name (the Director then answers with the duplicate message and the test ends ABORTED); no Inventory item named DISC-REUSE-AG.
//   For the case to mean "reuse", a NAKIVO agent (and its node) should already be on each AG host; the test cannot check that.
//   Today AAG-36.6 (10.10.36.6) is in Inventory and the .env AG variables still point at the old host 10.10.38.76 / AG_TESTDB84: update .env to
//   10.10.36.6 / AG_TESTDB86 and remove AAG-36.6 from Inventory first.
// Inventory side effects: adds one item named DISC-REUSE-AG; afterEach removes it (Remove host and keep transporter; a Failed row is cancelled).
// case-vs-ui (steps 1-2): the UI cannot show that the replicas answer ping/port or that the agent service is Running; only a signed-in Director is checked.
//   The lab AG is a single-replica Basic AG, so no secondary replica is involved.
// case-vs-ui (steps 3-4): Application is chosen in the Add Inventory Item wizard (Settings > Inventory > +); the default Type is Always On availability
//   group; the form asks for the WSFC host (Hostname or IP) and the AG name, not a listener.
// case-vs-ui (steps 5-6): NBR shows no "existing agent detected" message and no install/start time; "agent reused" is not observable, so only the
//   add (the wizard closes, one row, not a duplicate) and the completed discovery are asserted.
test.use(RUN_OPTIONS);

const AAG_TYPE = 'Microsoft SQL Server Always On availability group';

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
  'NAKIVO user can add a Microsoft SQL Server Always On availability group whose hosts already have an agent and its databases are discovered',
  { tag: '@NJM-157709' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, addInventoryItemPage, mssqlAgTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const displayName = 'DISC-REUSE-AG';

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(displayName)) {
        throw new Error(`ABORTED: an Inventory item named "${displayName}" already exists; remove it and run again`);
      }
    });

    await test.step('2. A NAKIVO agent is already installed and running on each AG replica node', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157709 step 2: the Windows services of the replica nodes are not observable in the UI; the presence of a running agent is not checked.' });
    });

    await test.step('3. Open the Add wizard and choose Application', async () => {
      // startAdd opens the wizard, chooses Application and goes to the Options step; the default Type is kept (case steps 3 and 4 are one UI action).
      await flows.startAdd();
      await expect(addInventoryItemPage.title).toBeVisible();
    });

    await test.step('4. Choose Microsoft SQL Server (Always On availability group): the form shows the host and credential fields', async () => {
      await expect(addInventoryItemPage.typeField).toHaveValue(AAG_TYPE);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 1)).toBeVisible();
    });

    await test.step('5. Enter the availability group host and valid credentials and finish: discovery starts', async () => {
      const outcome = await flows.submitAdd({ displayName, ...target });
      created.add(displayName);
      if (outcome === 'duplicate') {
        throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      }
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      await expect(inventoryPage.item(displayName)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157709 step 5: NBR shows no "existing agent detected" message; the row appears with Adding... after the wizard closes.' });
    });

    await test.step('6. Wait for the discovery to complete', async () => {
      expect(await flows.waitForDiscovery(displayName, 600_000), 'discovery of the availability group did not complete').toBe('discovered');
      await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
      await expect(inventoryPage.row(displayName)).toHaveCount(1);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-157709 step 6: whether the existing agents were reused (no re-install, unchanged install/start time) is not observable in the UI and is not asserted; only the completed discovery of a single item is.' });
    });

    await test.step('7. The Always On availability group is in Inventory and its databases are discovered and listed', async () => {
      await expect(inventoryPage.completedDetails(displayName)).toBeVisible();
      await flows.openItem(displayName);
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered availability group' })
        .toMatchObject({ type: AAG_TYPE, agName: target.agName, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
    });
  },
);
