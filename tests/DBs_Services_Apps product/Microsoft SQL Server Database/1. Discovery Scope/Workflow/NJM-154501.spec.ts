import { test } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { AgDiscoveryCase } from '../../../../../helpers/ag-discovery-case';
import { groupItemName } from '../../../../../helpers/item-names';

// NJM-154501: "[MSSQL-Disc-WF-0011] Verify Always On AG Metadata Discovery" (Verify AG Listener and Replica topology).
// Shared body: helpers/ag-discovery-case.ts (AgDiscoveryCase) and helpers/ag-topology.ts (what the SQL Server says about the AG).
// Lab preconditions: the owner fixed the host of this case: the Always On availability group of 10.10.38.76 (IT is preparing the lab, 2026-10-14). Its values
//   are the existing .env group NAKIVO_MSSQL_AG_* (the mssqlAgTarget fixture); the case ends ABORTED if that group's host is not 10.10.38.76, if the SQL Server cannot be
//   queried at that address (TCP 1433 and the SQL login), or if the AG has fewer than two replicas (a primary and at least one secondary are required, as in step 1).
//   The address must NOT be in Inventory under any name (duplicate = ABORTED). Not the same item as NJM-154361 (<name>, <name>-e): this one is <name>-md; run them one after the other.
// Inventory side effects: adds one item named AAG-<octets>-md; afterEach removes it with "Remove host and transporter (no uninstall)": the nodes the add created go, any
//   transporter software that was already on the hosts stays (nothing is uninstalled here). The nodes that exist before the add must be the only ones left.
// case-vs-ui (steps 3-6): NBR 11.2.1 shows an AG item as Display name (the address added), Type, Operating system, AG name, Total databases, SQL version, and "N hosts, M databases"
//   in the Inventory row. It shows no listener name, no replica list, no replica role and no database names. So: step 3 checks the type, the AG name and "No Issues"; step 4 compares the
//   host count and records the nodes that appeared; step 5 compares a role only if the page shows one; step 6 compares the database count. The SQL Server's replicas, roles and
//   databases are attached as evidence (sql-ag-truth) and every gap is a `case-vs-ui` annotation. UNVERIFIED: the first run on the prepared AG decides the counts and locators.
test.use(RUN_OPTIONS);

// The host the owner fixed for this case. No other host is allowed.
const REQUIRED_HOST = '10.10.38.76';

let agCase: AgDiscoveryCase | undefined;

test.afterEach(async () => {
  const current = agCase;
  agCase = undefined;
  await current?.dispose();
});

test(
  'NAKIVO discovers an Always On availability group through its listener and shows its type, AG name, host count and database count as the SQL Server reports them',
  { tag: '@NJM-154501' },
  async ({ signedIn: _signedIn, page, inventoryFlows, inventoryPage, removeHostFlows, mssqlAgTarget: target }, testInfo) => {
    test.setTimeout(2_400_000);
    if (target.host !== REQUIRED_HOST) throw new Error(`ABORTED: NJM-154501 must run on ${REQUIRED_HOST}, but the .env group NAKIVO_MSSQL_AG_* points at another host`);
    const lc = (agCase = new AgDiscoveryCase({ page, flows: inventoryFlows, inventoryPage, removeHostFlows }, target, `${groupItemName('AAG', target.host)}-md`, testInfo));

    await test.step('1. Precondition: NBR is up and the Always On AG (WSFC, one primary and one or more secondary replicas) is reachable via its listener', () => lc.precondition({ secondary: true }));
    await test.step('2. Add the AG through the listener address with valid credentials and run discovery: discovery completes and an Availability Group object is added to the Inventory', () => lc.addAndDiscover());
    await test.step('3. Open the Availability Group object: it is identified as an Always On Availability Group (listener name: see the case-vs-ui note)', () => lc.verifyIdentity());
    await test.step('4. Inspect the replicas: the number of hosts NBR shows equals the replicas of the AG (the names are not shown by the UI)', () => lc.verifyReplicas());
    await test.step('5. Identify the role reported for each replica: compared with the SQL Server where NBR shows a role (NBR 11.2.1 shows none)', () => lc.verifyRoles());
    await test.step('6. Inspect the databases listed under the AG: the database count NBR shows equals the availability databases of the SQL Server', () => lc.verifyDatabases());
    await test.step('Cleanup (not part of the case): the item is removed with "transporter (no uninstall)"; the Inventory and the nodes are as before', () => lc.cleanUp());
  },
);
