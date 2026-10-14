import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';
import { ObsBFlows } from '../../../../../flows/pkg-obsB.flows';

// NJM-159739: "[MSSQL-Inv-UI-Details-cluster-0009] Verify Database Icon Asset".
// Lab preconditions: the failover cluster instance item FCI-33.140 is in Inventory and shows its database rows (9 observed 2026-10-09 although the item is Inaccessible).
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 1): the item is the existing FCI-33.140, which is Inaccessible today; the test only needs its database rows.
// case-vs-ui (step 2): the Inventory page is Settings > Inventory (not "Configuration").
// case-vs-ui (step 3): the item opens as a page, not a "Details panel".
// case-vs-ui (step 4): the databases are listed as a tree on the item page; there is nothing to expand.
// case-vs-ui (step 5): the icon asset "SQLD003" is not identifiable by the test. The test asserts what NBR renders next to every database entry: an icon element
//   with the class iconDbDatabase24, 32x32 px, image db-icons.svg#database, whose image file is served (HTTP 200); the number of icons equals "Total databases".
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page of a SQL failover cluster instance shows a database icon next to every listed database',
  { tag: '@NJM-159739' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const obs = new ObsBFlows(page);
    const name = LAB_ITEMS.failoverCluster;

    await test.step('1. Precondition: the SQL failover cluster instance is listed in the Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.item(name)).toBeVisible();
    });

    await test.step('2. Open Settings > Inventory: the Inventory page lists the discovered items', async () => {
      await expect(inventoryPage.item(name)).toBeVisible();
    });

    await test.step('3. Select the item and open its page: the item page is displayed', async () => {
      await flows.openItem(name);
      await expect(obs.healthBadge()).toBeVisible();
      await expect(inventoryItemPage.detail('Type:')).toHaveText('Microsoft SQL Server failover cluster instance');
    });

    await test.step('4. The list of databases discovered under the item is displayed', async () => {
      await expect(obs.databaseIcons().first()).toBeVisible();
      const total = ((await inventoryItemPage.detail('Total databases:').textContent({ timeout: 30_000 })) ?? '').trim();
      expect(total).toMatch(/^[1-9]\d*$/);
      await expect(obs.databaseIcons()).toHaveCount(Number(total));
    });

    await test.step('5. Every database entry shows its database icon (rendered, not broken)', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-159739 step 5: the icon asset SQLD003 is not identifiable; the observed database icon class, size and image are asserted and the image file is requested.' });
      const rows = await obs.readDatabaseRows();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.iconImage, `the icon of "${row.name}" has no database image`).toContain('db-icons.svg#database');
        expect([row.iconWidth, row.iconHeight], `the icon of "${row.name}" has an unexpected size`).toEqual([32, 32]);
      }
      expect(await obs.iconAssetStatus(), 'the database icon image file is not served').toBe(200);
    });
  },
);
