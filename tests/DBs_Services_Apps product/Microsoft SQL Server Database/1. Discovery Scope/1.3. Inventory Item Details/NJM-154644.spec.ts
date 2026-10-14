import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';

// NJM-154644: "[DBM-Inv-UI-Details-0011] Verify App Details - Total Databases".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 is in Inventory, discovered (shows "N databases").
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 2): the Inventory page is Settings > Inventory; the section is "Instance details" (NBR 11.2.1 has no "Application Details" section).
// case-vs-ui (step 3): the field is labelled "Total databases:".
// case-vs-ui (step 4): the value is compared with the "N databases" of the item's Inventory row; the number of databases on the SQL server is not read
//   (no host-side client exists in the project yet) and the database list on the item page is not counted (its entries have no locator yet).
test.use(RUN_OPTIONS);

const DATABASE_COUNT = /^[1-9]\d*$/;

test(
  'NAKIVO Inventory item page Instance details shows Total databases equal to the item row count',
  { tag: '@NJM-154644' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage }, testInfo) => {
    test.setTimeout(300_000);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the SQL instance is discovered with a database count', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page and the details of the SQL item: Instance details is shown', async () => {
      await flows.openItem(name);
      await expect(inventoryItemPage.text('Instance details')).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154644 step 2: the section is "Instance details"; NBR 11.2.1 has no "Application Details" section.' });
    });

    await test.step('3. The Instance details section has a Total databases field with a numeric value', async () => {
      await expect(inventoryItemPage.text('Total databases:')).toBeVisible();
      await expect
        .poll(() => flows.readItemDetails(), { message: 'Total databases is not a positive number' })
        .toMatchObject({ totalDatabases: expect.stringMatching(DATABASE_COUNT) });
    });

    await test.step('4. Total databases equals the number of databases the item reports in the Inventory list', async () => {
      const details = await flows.readItemDetails();
      await flows.gotoInventory();
      const row = await flows.readRow(name);
      const rowCount = /(\d+) databases?/.exec(row.details)?.[1];
      expect(rowCount, `the Inventory row of ${name} shows no database count ("${row.details}")`).toBeDefined();
      expect(details.totalDatabases).toBe(rowCount);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154644 step 4: compared with the Inventory row count; the databases on the SQL server and the entries of the database list are not counted.' });
    });
  },
);
