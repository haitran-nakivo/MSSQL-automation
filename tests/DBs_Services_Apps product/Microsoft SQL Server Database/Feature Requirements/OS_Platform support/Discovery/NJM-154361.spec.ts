import { test } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { InstanceLifecycle } from '../../../../../../helpers/instance-lifecycle';

// NJM-154361: "Verify adding/ editing/ removing Windows Server 2025 hosting SQL Server 2025 Enterprise - MSSQL AAGs".
// Display name (owner format): AAG / RSAG / FCI-<last two octets of the host IP>, or WS<year>-SQL<year>-<last two octets> for a server instance, for example AAG-38.76 or WS2022-SQL2025-19.145 (helpers/item-names.ts). Variants: -e (renamed), -d (rejected duplicate).
// Lab preconditions: the owner fixed the host of this case: the Always On availability group on host 10.10.38.76. No other host may be used: the values come from the existing
//   .env group NAKIVO_MSSQL_AG_* (the mssqlAgTarget fixture), and the test ends ABORTED if that group's host is not 10.10.38.76 ("Missing in .env" when the group is absent).
//   The AG name and credentials are whatever that group holds. The host must NOT be in Inventory under any name (duplicate = ABORTED); no item named <name>, <name>-e
//   or <name>-d.
// Not verified: that this host still runs Windows Server 2025 and SQL Server 2025 Enterprise (an earlier note says its AG may no longer exist); the test asserts the OS and the SQL version.
// Shared body: helpers/instance-lifecycle.ts (InstanceLifecycle, kind 'ag'); this file holds the Xray steps. NJM-154364 is the reference.
// Host state: the case refuses to start (ABORTED) when the host already has a node in Settings > Nodes or a listener on port 9446 that it did not create. Steps 7 and 8 run once per
//   Remove option, in this order: (1) "uninstall transporter" removes <name>-e; (2) "transporter (no uninstall)" and (3) "keep transporter" each add the item again (<name>-r2, <name>-r3),
//   verify the baseline, remove, and verify NBR (Inventory, Settings > Nodes) and the hosts (port 9446, service bhsvc). Each scenario starts from and ends in the clean state (no item, no node,
//   no transporter); the case ends clean, and afterEach repeats that cleanup if the case stopped early. Run with --workers=1 and nothing else on these hosts.
// Member hosts: a cluster item brings several hosts. Their nodes are learned as the nodes that appear in Settings > Nodes after the add (no member host is configured); options 2 and 3 are expected
//   to remove the nodes of EVERY host of the item (workflows/inventory/remove-mssql-item.md, seen on an Always On AG). UNVERIFIED: that the members accept the item's OS login for the WinRM service
//   check (without WinRM only port 9446 is checked, with a `host-service-check` annotation), the behavior of the three options for this item type, and the node text after "keep transporter".
// Inventory side effects: adds <name> (and <name>-e, <name>-r2, <name>-r3 during the Remove step); the ad hoc duplicate add is rejected and creates nothing.
// case-vs-ui: the cases say "Configuration > Inventory > Add New > Application/Database": the UI is Settings > Inventory, the "+" button, the Application tile and the Type list.
// case-vs-ui: "Manage/Edit" is the Edit button of the item page and "Remove/Delete" is the Remove button; the case does not name a Remove option, so the three options of the dialog are all run.
// case-vs-ui: "change the credentials/settings" changes the Display name (the lab has one valid credential pair); the form's other fields are checked as pre-populated.
// Ad hoc steps (beyond the case text, from the observed UI): duplicate add is rejected, Cancel on Edit discards the change, Cancel on Remove keeps the item.
test.use(RUN_OPTIONS);

// The host the owner fixed for this case. No other host is allowed.
const REQUIRED_HOST = '10.10.38.76';

let lifecycle: InstanceLifecycle | undefined;

// Returns Inventory, Nodes and the hosts to the state before the case if it stopped early (the original failure is what the report shows).
test.afterEach(async () => {
  const current = lifecycle;
  lifecycle = undefined;
  await current?.dispose();
});

test(
  'NAKIVO user can add, edit and remove a Microsoft SQL Server Always On availability group on Windows Server 2025 hosting SQL Server 2025 Enterprise in Inventory',
  { tag: '@NJM-154361' },
  async ({ signedIn: _signedIn, page, inventoryFlows, inventoryPage, inventoryItemPage, editInventoryItemPage, addInventoryItemPage, wizardFlows, removeHostFlows, mssqlAgTarget: target }, testInfo) => {
    test.setTimeout(7_200_000); // add/edit plus three Remove scenarios, two of them with an add-back and an uninstall cleanup
    if (target.host !== REQUIRED_HOST) throw new Error(`ABORTED: NJM-154361 must run on ${REQUIRED_HOST}, but the .env group NAKIVO_MSSQL_AG_* points at another host`);
    const lc = (lifecycle = new InstanceLifecycle(
      { page, flows: inventoryFlows, inventoryPage, inventoryItemPage, editInventoryItemPage, addInventoryItemPage, wizardFlows, removeHostFlows },
      target,
      { key: 'NJM-154361', kind: 'ag', osText: 'Windows Server 2025', sqlMajor: '17', sqlName: 'SQL Server 2025' },
      testInfo,
    ));

    await test.step('1. Precondition: Director is accessible and the Windows Server 2025 / SQL Server 2025 host is not in the Inventory', () => lc.precondition());
    await test.step('2. Open Settings > Inventory > + and choose Application, then the Always On availability group type: the Options step is shown', () => lc.openAddWizard());
    await test.step('3. Enter the host and SQL credentials and add the item: the wizard closes and the item is listed', () => lc.addItem());
    await test.step('4. Verify database discovery: the databases are discovered and the item has no issues', () => lc.verifyDiscovery());
    await test.step('Ad hoc (negative): adding the same host again is rejected as a duplicate and creates no second item', () => lc.rejectDuplicateAdd());
    await test.step('5. Select the item and click Edit: the form is pre-populated with the current values and the Type cannot be changed', () => lc.openEditForm());
    await test.step('Ad hoc (negative): Cancel on Edit asks for confirmation and Close discards the change', () => lc.cancelEdit());
    await test.step('6. Change the settings and save: the edit is accepted and the item is rediscovered', () => lc.saveEdit());
    await test.step('Ad hoc (negative): Cancel in the Remove dialog keeps the item', () => lc.cancelRemove());
    // Xray steps 7 (Remove) and 8 (verify it is gone), once per Remove option.
    for (const step of lc.removalSteps(7)) await test.step(step.title, step.run);
    await test.step('Final: the Inventory is back to its starting item count and nothing of this case is left in NBR or on the hosts', () => lc.finalCheck());
  },
);
