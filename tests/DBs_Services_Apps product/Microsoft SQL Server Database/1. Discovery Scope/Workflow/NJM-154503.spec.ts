import { test } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { AgDiscoveryCase } from '../../../../../helpers/ag-discovery-case';
import { readOsPlatformAgListenerTarget } from '../../../../../helpers/credentials';
import { groupItemName } from '../../../../../helpers/item-names';

// NJM-154503: "[MSSQL-Disc-WF-0013] Verify DAG Unsupported Block" (Verify Distributed AGs are not discovered or marked unsupported).
// Shared body: helpers/ag-discovery-case.ts (AgDiscoveryCase) and helpers/ag-topology.ts (what the SQL Server says about the AG and any distributed AG).
// Lab (owner, 2026-10-14): a distributed AG over two AGs in separate clusters: nodes 10.10.38.99, .100, .101, .102; listeners AG1-LST.lab.local = 10.10.38.107 and
//   AG2-LST.lab.local = 10.10.38.108. The case adds the AG1 listener address. Its values are the .env group NAKIVO_OSP_NJM154503_* (HOST = 10.10.38.107, OS_USERNAME,
//   OS_PASSWORD, SQL_USERNAME, SQL_PASSWORD); the AG name is read from the SQL Server by the listener IP, nothing else is configured. A missing value ends the case ABORTED
//   ("Missing in .env"); so does a SQL Server that cannot be queried (TCP 1433 and the login) or one with no distributed AG. The address must NOT be in Inventory (duplicate = ABORTED).
// Inventory side effects: adds one item named AAG-<octets>-dag; afterEach removes it with "Remove host and transporter (no uninstall)": the nodes the add created go, any
//   transporter software that was already on the hosts stays (the lab hosts already answer on port 9446; nothing is uninstalled here). The nodes that exist before the add must
//   be the only ones left.
// case-vs-ui (step 3): the expected result says both "Discovery does not add the DAG as a supported item" and "Discovery added AG successfully". Both hold when the underlying AG is added and
//   the distributed AG is not, and that is what is asserted: exactly one new item, of the Always On AG type, named for the underlying AG, no item with a distributed AG's name, no Failed
//   badge. NBR's behavior for a distributed AG was never observed (no DAG in the lab until now): the first live run shows it, and the SQL Server's view is attached (sql-ag-truth).
// UNVERIFIED: written before the first run against the DAG lab.
test.use(RUN_OPTIONS);

let agCase: AgDiscoveryCase | undefined;

test.afterEach(async () => {
  const current = agCase;
  agCase = undefined;
  await current?.dispose();
});

test(
  'NAKIVO adds the availability group behind a distributed AG access point and does not add the distributed AG as an item',
  { tag: '@NJM-154503' },
  async ({ signedIn: _signedIn, page, inventoryFlows, inventoryPage, removeHostFlows }, testInfo) => {
    test.setTimeout(2_400_000);
    const target = readOsPlatformAgListenerTarget('NJM-154503');
    const lc = (agCase = new AgDiscoveryCase({ page, flows: inventoryFlows, inventoryPage, removeHostFlows }, target, `${groupItemName('AAG', target.host)}-dag`, testInfo));

    await test.step('1. Precondition: NBR is up and a Distributed Availability Group is reachable (the SQL Server shows the distributed AG and the AG behind the listener)', () => lc.precondition({ distributedAg: true }));
    await test.step('2. Enter the DAG access point (the listener address) with valid credentials in Settings > Inventory > + > Application > Microsoft SQL Server: the dialog accepts them', () => lc.submitEntry());
    await test.step('3. Attempt to discover / add the Distributed Availability Group: the AG is added, the distributed AG is not added as a supported item', async () => {
      await lc.waitForDiscovery();
      await lc.verifyDagNotAdded();
    });
    await test.step('Cleanup (not part of the case): the item is removed with "transporter (no uninstall)"; the Inventory and the nodes are as before', () => lc.cleanUp());
  },
);
