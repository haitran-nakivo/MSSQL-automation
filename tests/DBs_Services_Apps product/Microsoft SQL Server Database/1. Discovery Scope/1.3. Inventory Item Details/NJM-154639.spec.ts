import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';

// NJM-154639: "[DBM-Inv-UI-Details-0006] Verify 'X Databases' Count Accuracy".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 is in Inventory, discovered (shows "N databases").
// Inventory side effects: none (the item is only read).
// case-vs-ui (steps 2-3): the Inventory page is Settings > Inventory; NBR 11.2.1 has no 'X Databases' widget in a summary bar: the count is "Total databases"
//   in the "Instance details" section of the item page.
// case-vs-ui (step 4): the count is compared with the "N databases" of the item's Inventory row (the other count NBR shows); the number of databases
//   on the SQL server itself is not read (no host-side check exists in the project yet).
// case-vs-ui (step 5): not executed. It needs a database added or removed on the SQL host and a Refresh of the item; neither is available to the test
//   (no host-side client, and the Refresh control and its completion signal are not observed).
test.use(RUN_OPTIONS);

const DATABASE_COUNT = /^[1-9]\d*$/;

test(
  'NAKIVO Inventory item page Total databases is numeric and equals the database count of the item row',
  { tag: '@NJM-154639' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage }, testInfo) => {
    test.setTimeout(300_000);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the SQL instance is discovered with a database count', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page and the details of the SQL item', async () => {
      await expect(inventoryPage.item(name)).toBeVisible();
      await flows.openItem(name);
    });

    await test.step('3. The database count on the item page is numeric', async () => {
      await expect
        .poll(() => flows.readItemDetails(), { message: 'the item page does not show a numeric database count' })
        .toMatchObject({ totalDatabases: expect.stringMatching(DATABASE_COUNT) });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154639 step 3: NBR 11.2.1 has no "X Databases" widget; the count is "Total databases" in Instance details.' });
    });

    await test.step('4. The count equals the number of databases the item reports in the Inventory list', async () => {
      const details = await flows.readItemDetails();
      await flows.gotoInventory();
      const row = await flows.readRow(name);
      const rowCount = /(\d+) databases?/.exec(row.details)?.[1];
      expect(rowCount, `the Inventory row of ${name} shows no database count ("${row.details}")`).toBeDefined();
      expect(details.totalDatabases).toBe(rowCount);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154639 step 4 (and step 5, not executed): compared with the Inventory row count; the database count on the SQL server and the update after a change on the source are not verified.' });
    });
  },
);
