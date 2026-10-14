import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS, P09Flows, exactIgnoreCase } from '../../../../../flows/pkg-P09.flows';

// NJM-154656: "[MSSQL-Inv-UI-Details-cluster-0004] Verify Instance Details Widget (FCI)".
// Lab preconditions: the FCI item FCI-33.140 (host of mssqlFciTarget) is in Inventory and discovered (shows "N databases"). TODAY it is Inaccessible: the
//   test then ends ABORTED until the FCI is repaired.
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 2): the Inventory page is Settings > Inventory; the widget is the "Instance details" section.
// case-vs-ui (step 3): the section shows Instance name, Total databases and SQL version; NBR 11.2.1 shows no SQL edition and (as far as observed) no cluster nodes.
// case-vs-ui (step 4): values are compared with what the lab knows (the configured FCI instance name, the item row count), not with values read from the
//   SQL server; the cluster nodes are not verified.
// case-vs-ui (step 5): "visual defects" are read as clipped text, text outside the window and overlapping texts.
test.use(RUN_OPTIONS);

const DATABASE_COUNT = /^[1-9]\d*$/;
const SQL_VERSION = /^\d+\.\d+/;

test(
  'NAKIVO Inventory item page Instance details shows the instance name, database count and SQL version of a failover cluster instance',
  { tag: '@NJM-154656' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page, mssqlFciTarget: target }, testInfo) => {
    test.setTimeout(300_000);
    const layout = new P09Flows(page);
    const name = LAB_ITEMS.failoverCluster;

    await test.step('1. Precondition: the SQL failover cluster instance is discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      if ((await inventoryPage.discoveredDetails(name).count()) === 0) throw new Error(`ABORTED: "${name}" is not discovered (no database count in its row; it is Inaccessible or Failed); repair it and run again`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page and the details of the FCI: Instance details is shown', async () => {
      await flows.openItem(name);
      await expect(inventoryItemPage.text('Instance details')).toBeVisible();
    });

    await test.step('3. The Instance details widget shows the instance-level fields', async () => {
      for (const label of ['Instance name:', 'Total databases:', 'SQL version:']) {
        await expect(inventoryItemPage.text(label), `Instance details shows no "${label}"`).toBeVisible();
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154656 step 3: the case expects an edition and cluster nodes; NBR 11.2.1 shows no SQL edition and, as far as observed, no cluster nodes, so only instance name, total databases and SQL version are checked.' });
    });

    await test.step('4. Each field shows the value of the FCI', async () => {
      await expect
        .poll(() => flows.readItemDetails(), { message: 'Instance details does not show the values of the failover cluster instance' })
        .toMatchObject({ instanceName: expect.stringMatching(exactIgnoreCase(target.instanceName)), totalDatabases: expect.stringMatching(DATABASE_COUNT), sqlVersion: expect.stringMatching(SQL_VERSION) });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154656 step 4: values are compared with the configured FCI instance name and a build-number pattern, not with values read from the SQL server; the cluster nodes are not verified.' });
    });

    await test.step('5. The widget renders without clipping, outside-window text or overlap', async () => {
      const boxes = await layout.measureAll(['Instance details', 'Instance name:', 'Total databases:', 'SQL version:']);
      for (const box of boxes) {
        expect(box.found, `"${box.text}" is not on the page`).toBe(true);
        expect(box.clipped, `"${box.text}" is clipped`).toBe(false);
        expect(box.insideViewport, `"${box.text}" is outside the window`).toBe(true);
      }
      expect(layout.overlappingPairs(boxes)).toEqual([]);
    });
  },
);
