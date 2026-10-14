import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';
import { ObsBFlows } from '../../../../../flows/pkg-obsB.flows';

// NJM-154645: "[DBM-Inv-UI-Details-0012] Verify Databases Widget List Content".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 is in Inventory, discovered with the 6 databases observed on 2026-10-09
//   (AdventureWorks2025, AdventureWorksDW2025, AdventureWorksLT2025, master, model, msdb). If the databases of that SQL instance change, step 4 fails.
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 2): the Inventory page is Settings > Inventory; NBR 11.2.1 has no "Databases widget": the databases are the tree list below the
//   "Instance details" section of the item page.
// case-vs-ui (step 4): the "actual discovered databases" are the 6 names observed in the lab on 2026-10-09 (tempdb is not listed by NBR); the databases on the
//   SQL server itself are not read (no host-side check exists).
// case-vs-ui (step 5): there is no 'X Databases' summary count; the entries are compared with "Total databases" of the item page and with the "N databases"
//   of the Inventory row.
test.use(RUN_OPTIONS);

const OBSERVED_DATABASES = ['AdventureWorks2025', 'AdventureWorksDW2025', 'AdventureWorksLT2025', 'master', 'model', 'msdb'];

test(
  'NAKIVO Inventory item page lists the discovered databases of a SQL instance and the list matches the database count',
  { tag: '@NJM-154645' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const obs = new ObsBFlows(page);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the SQL instance is discovered with several databases', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory view and the details of the instance: the item page shows the databases list', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154645 step 2: Settings > Inventory; the databases are a tree list on the item page, not a "Databases widget".' });
      await flows.openItem(name);
      await expect(obs.databaseIcons().first()).toBeVisible();
    });

    await test.step('3. Review the list of databases: it has database entries', async () => {
      await expect.poll(async () => (await obs.readDatabaseRows()).length, { message: 'the databases list is empty' }).toBeGreaterThan(0);
    });

    await test.step('4. Compare the listed databases with the discovered ones: every observed database is listed and no extra entry is shown', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154645 step 4: compared with the 6 databases observed in the lab; the databases on the SQL server are not read.' });
      const names = (await obs.readDatabaseRows()).map((row) => row.name).sort();
      expect(names).toEqual([...OBSERVED_DATABASES].sort());
    });

    await test.step('5. The number of listed databases matches the database count', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154645 step 5: there is no "X Databases" summary count; compared with "Total databases" of the item page and the "N databases" of the Inventory row.' });
      const listed = (await obs.readDatabaseRows()).length;
      await expect(inventoryItemPage.detail('Total databases:')).toHaveText(String(listed));
      await flows.gotoInventory();
      await expect(inventoryPage.row(name).getByText(`${listed} databases`, { exact: true })).toBeVisible();
    });
  },
);
