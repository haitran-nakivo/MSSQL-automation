import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154747: "[DBM-BK-UI-Source-Left Pane-0009] Verify Tree Ordering".
// Env (.env, owner-supplied): none beyond the Director login (the Inventory must hold at least two SQL items to prove an order).
// Side effects: none (reads Settings > Inventory, opens the wizard and cancels it).
// case-vs-ui: the case reads the Inventory first and the tree second; the Inventory table also lists non-SQL items, so the tree is read first to know which rows
//   are SQL items, then the Inventory table is read, and the relative order of those items is compared.
// case-vs-ui: "Inventory > Create" is Settings > Inventory; the wizard is Data Protection > "+" > Backup for Database.
test.use(RUN_OPTIONS);

test('NAKIVO lists the Step 1 source tree items in the same order as the Inventory table', { tag: '@NJM-154747' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  let treeItems: string[] = [];
  let positions: number[] = [];

  await test.step('3. (first) Open the wizard and read the order of the top-level items in the source tree', async () => {
    await flows.openStep1();
    treeItems = (await flows.readTree()).filter((n) => n.depth === 0).map((n) => n.name);
    expect(treeItems.length, 'the order needs at least two SQL items in Inventory').toBeGreaterThanOrEqual(2);
    await flows.leaveWizard();
  });

  await test.step('1+2. Open Settings > Inventory and note the order of the SQL items', async () => {
    const rows = await flows.readInventoryRows();
    positions = BkA3SourcesFlows.positionsIn(rows, treeItems);
    testInfo.annotations.push({ type: 'observed-outcome', description: `tree order: ${JSON.stringify(treeItems)}; Inventory row positions: ${JSON.stringify(positions)}` });
    expect(positions.filter((p) => p < 0), 'items of the tree that Inventory does not list').toEqual([]);
  });

  await test.step('4. The source tree order matches the Inventory order exactly', async () => {
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });
});
