import { test } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { InstanceLifecycle } from '../../../../../../helpers/instance-lifecycle';

// NJM-187289: "Verify adding/ editing/ removing Windows Server 2025 hosting SQL Server 2025 Enterprise - MSSQL Read-Scale AG".
// One end-to-end case in 9 Xray steps (this file keeps that step list; the body of each step is shared: helpers/instance-lifecycle.ts, kind 'readScale').
// Lab preconditions: the Read-Scale AG of the .env group NAKIVO_MSSQL_READSCALE_* (the mssqlReadScaleTarget fixture); the test ends ABORTED if that group's host is not
//   10.10.33.141 ("Missing in .env" when the group is absent). The host must NOT be in Inventory under any name (duplicate = ABORTED); no item named <name>, <name>-e, <name>-d.
// Result mapping (reporters/status.reporter.ts): all steps pass = PASS; an unmet expectation = FAIL; a problem that stops the case from running (sign-in, the host is already in Inventory,
//   a node or transporter of the host that this case did not create, timeout) = ABORTED.
// Host state: the case refuses to start (ABORTED) when the host already has a node in Settings > Nodes or a listener on port 9446 that it did not create. Steps 8 and 9 run once per
//   Remove option, in this order: (1) "uninstall transporter" removes <name>-e; (2) "transporter (no uninstall)" and (3) "keep transporter" each add the item again (<name>-r2, <name>-r3),
//   verify the baseline, remove, and verify NBR (Inventory, Settings > Nodes) and the hosts (port 9446, service bhsvc). Each scenario starts from and ends in the clean state (no item, no node,
//   no transporter); the case ends clean, and afterEach repeats that cleanup if the case stopped early. Run with --workers=1 and nothing else on these hosts.
// Member hosts: the nodes that appear in Settings > Nodes after the add are taken as the item's hosts (no member host is configured); options 2 and 3 are expected to remove the nodes of EVERY
//   host of the item (workflows/inventory/remove-mssql-item.md, seen on an Always On AG). UNVERIFIED: that the members accept the item's OS login for the WinRM service check (without WinRM only
//   port 9446 is checked, with a `host-service-check` annotation), the behavior of the three options for a Read-Scale AG, and the node text after "keep transporter".
// case-vs-ui: step 5 expects the Enterprise edition; the current Director (11.2.1.112232) shows the SQL version only (no edition on the item page, in the Edit wizard or in the page HTML), so OS and
//   SQL version are verified and the edition is not. Step 7 expects changed credentials; the lab has one valid credential pair, so the Display name is changed.
// Evidence: a screenshot is attached after the add and after the discovery check (evidence-after-add, evidence-item-page); the video, the trace and the per-step results are kept by the reporter.
// Not part of the Xray case (and not in the earlier version of this spec): the duplicate-add and Cancel ad hoc steps of the sibling cases.
test.use(RUN_OPTIONS);

// The host the owner fixed for this case. No other host is allowed.
const REQUIRED_HOST = '10.10.33.141';

let lifecycle: InstanceLifecycle | undefined;

// Returns Inventory, Nodes and the hosts to the state before the case if it stopped early (the original failure is what the report shows).
test.afterEach(async () => {
  const current = lifecycle;
  lifecycle = undefined;
  await current?.dispose();
});

test(
  'NAKIVO user can add, verify, edit and remove a Windows Server 2025 hosting SQL Server 2025 Read-Scale availability group',
  { tag: '@NJM-187289' },
  async ({ signedIn: _signedIn, page, inventoryFlows, inventoryPage, inventoryItemPage, editInventoryItemPage, addInventoryItemPage, wizardFlows, removeHostFlows, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(7_200_000); // add/edit plus three Remove scenarios, two of them with an add-back and an uninstall cleanup
    if (target.host !== REQUIRED_HOST) throw new Error(`ABORTED: NJM-187289 must run on ${REQUIRED_HOST}, but the .env group NAKIVO_MSSQL_READSCALE_* points at another host`);
    const lc = (lifecycle = new InstanceLifecycle(
      { page, flows: inventoryFlows, inventoryPage, inventoryItemPage, editInventoryItemPage, addInventoryItemPage, wizardFlows, removeHostFlows },
      target,
      { key: 'NJM-187289', kind: 'readScale', osText: 'Windows Server 2025', sqlMajor: '17', sqlName: 'SQL Server 2025' },
      testInfo,
    ));

    await test.step('1. Precondition: NBR is up and signed in, and no item with the test name is in Inventory', () => lc.precondition());
    await test.step('2. Open the Add wizard and choose Application > Microsoft SQL Server (Read-Scale AG type)', () => lc.openAddWizard());
    await test.step('3. Enter the Read-Scale AG address and SQL credentials and add it to Inventory', () => lc.addItem());
    await test.step('4. Discovery completes and the databases of the Read-Scale AG are listed', () => lc.verifyDiscovery());
    await test.step('5. The Inventory reports Windows Server 2025 and SQL Server 2025', () => lc.verifyVersionAndEdition('Enterprise'));
    await test.step('6. Edit opens pre-populated with the current settings', () => lc.openEditForm());
    await test.step('7. Change a setting and save; the item reconnects and rediscovers its databases', () => lc.saveEdit());
    // Xray steps 8 (Remove: a confirmation is shown and accepted) and 9 (the item and its databases no longer appear), once per Remove option.
    for (const step of lc.removalSteps(8)) await test.step(step.title, step.run);
    await test.step('Final: the Inventory is back to its starting item count and nothing of this case is left in NBR or on the hosts', () => lc.finalCheck());
  },
);
