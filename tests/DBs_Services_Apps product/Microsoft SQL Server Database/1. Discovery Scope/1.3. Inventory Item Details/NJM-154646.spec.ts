import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';
import { ObsBFlows } from '../../../../../flows/pkg-obsB.flows';

// NJM-154646: "[DBM-Inv-UI-Details-0013] Verify Databases Widget Format (Icon+Name)".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 is in Inventory, discovered; it has the database AdventureWorks2025 (observed 2026-10-09).
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 2): the Inventory page is Settings > Inventory; the databases are a tree list on the item page, not a "Databases widget".
// case-vs-ui (step 3): the entry is an icon element (img.x-tree-icon.iconDbDatabase24) in the same row element as the database name text; the case's
//   data <sql-db-name> is AdventureWorks2025.
// case-vs-ui (step 4): the correct icon is checked as the observed database icon (class iconDbDatabase24, 32x32 px, image db-icons.svg#database); the
//   design asset identity is not verified. "No truncation" is checked as the name's element not being clipped.
test.use(RUN_OPTIONS);

const DATABASE = 'AdventureWorks2025';

test(
  'NAKIVO Inventory item page shows each database entry as a database icon followed by the database name',
  { tag: '@NJM-154646' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const obs = new ObsBFlows(page);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the SQL instance is discovered with at least one database', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory view and the details of the instance: the item page shows the databases list', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154646 step 2: Settings > Inventory; the databases are a tree list on the item page.' });
      await flows.openItem(name);
      await expect(obs.databaseIcons().first()).toBeVisible();
    });

    await test.step('3. Inspect a database entry: it is an icon followed by the name', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154646 step 3: <sql-db-name> is AdventureWorks2025; the icon is an img element in the row of the name.' });
      await expect.poll(async () => (await obs.readDatabaseRows()).map((row) => row.name), { message: `the entry "${DATABASE}" is not listed` }).toContain(DATABASE);
      for (const row of await obs.readDatabaseRows()) expect(row.name, 'a database entry has no name next to its icon').not.toBe('');
    });

    await test.step('4. The entry shows the database icon and the full database name', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154646 step 4: the icon is verified as the observed database icon (class, size 32x32, image db-icons.svg#database); the design asset identity is not verified.' });
      const row = (await obs.readDatabaseRows()).find((entry) => entry.name === DATABASE);
      expect(row, `the entry "${DATABASE}" is not listed`).toBeDefined();
      expect(row?.iconImage).toContain('db-icons.svg#database');
      expect([row?.iconWidth, row?.iconHeight]).toEqual([32, 32]);
      expect(row?.clipped, `the name "${DATABASE}" is cut off`).toBe(false);
    });
  },
);
