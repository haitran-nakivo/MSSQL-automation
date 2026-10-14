import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS, P09Flows, exactIgnoreCase } from '../../../../../flows/pkg-P09.flows';

// NJM-154655: "[MSSQL-Inv-UI-Details-instance-0004] Verify Instance Details Widget (Instance)".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 (host of mssqlInstanceTarget, SQL Server 2025) is in Inventory and discovered.
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 2): the Inventory page is Settings > Inventory; the widget is the "Instance details" section.
// case-vs-ui (step 3): the section shows Instance name, Total databases and SQL version; NBR 11.2.1 shows no SQL edition anywhere.
// case-vs-ui (step 4): values are compared with what the lab knows (the configured instance name, SQL Server 2025 = version 17.x, the item row count), not with
//   values read from the SQL server (no host-side client exists in the project yet).
// case-vs-ui (step 5): "visual defects" are read as clipped text, text outside the window and overlapping texts.
test.use(RUN_OPTIONS);

const DATABASE_COUNT = /^[1-9]\d*$/;
const SQL_2025_VERSION = /^17\./;

test(
  'NAKIVO Inventory item page Instance details shows the instance name, database count and SQL version of a standalone instance',
  { tag: '@NJM-154655' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(300_000);
    const layout = new P09Flows(page);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the standalone SQL instance is discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page and the details of the standalone instance: Instance details is shown', async () => {
      await flows.openItem(name);
      await expect(inventoryItemPage.text('Instance details')).toBeVisible();
    });

    await test.step('3. The Instance details widget shows the instance-level fields', async () => {
      for (const label of ['Instance name:', 'Total databases:', 'SQL version:']) {
        await expect(inventoryItemPage.text(label), `Instance details shows no "${label}"`).toBeVisible();
      }
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154655 step 3: the case expects an edition; NBR 11.2.1 shows no SQL edition, so only instance name, total databases and SQL version are checked.' });
    });

    await test.step('4. Each field shows the value of the standalone instance', async () => {
      await expect
        .poll(() => flows.readItemDetails(), { message: 'Instance details does not show the values of the standalone instance' })
        .toMatchObject({ instanceName: expect.stringMatching(exactIgnoreCase(target.instanceName)), totalDatabases: expect.stringMatching(DATABASE_COUNT), sqlVersion: expect.stringMatching(SQL_2025_VERSION) });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154655 step 4: values are compared with the configured instance name and the SQL Server 2025 version of the lab host (17.x), not with values read from the SQL server.' });
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
