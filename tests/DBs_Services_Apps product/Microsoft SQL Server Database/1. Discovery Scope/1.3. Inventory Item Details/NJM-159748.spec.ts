import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS, addReadScaleItem, listedInInventory } from '../../../../../flows/pkg-P10.flows';
import { ObsBFlows } from '../../../../../flows/pkg-obsB.flows';

// NJM-159748: "[MSSQL-Inv-UI-Details-RS-0009] Verify Database Icon Asset".
// Lab preconditions: the Read-Scale AG host 10.10.33.141 (the fixture mssqlReadScaleTarget, AG ReadScaleAG, 3 databases) is reachable; the item RSAG-33.141
//   is in Inventory, or the test adds it (the host must not be in Inventory under another name, else ABORTED).
// Inventory side effects: none when RSAG-33.141 exists; otherwise the test adds RSAG-33.141 and removes it again in afterEach (keep transporter).
// case-vs-ui (step 1): the test adds and discovers the Read-Scale AG itself when it is not listed.
// case-vs-ui (step 2): the Inventory page is Settings > Inventory (not "Configuration").
// case-vs-ui (step 3): the item opens as a page, not a "Details panel".
// case-vs-ui (step 4): the databases are listed as a tree on the item page; there is nothing to expand.
// case-vs-ui (step 5): the icon asset "SQLD003" is not identifiable by the test. The test asserts what NBR renders next to every database entry: an icon element
//   with the class iconDbDatabase24, 32x32 px, image db-icons.svg#database, whose image file is served (HTTP 200); the number of icons equals "Total databases".
//   The database list of a Read-Scale AG item page is not observed in the notes; the test assumes it uses the same icon element as the instance list.
test.use(RUN_OPTIONS);

// Names this test created (only these are ever removed).
const created = new Set<string>();

test.afterEach(async ({ inventoryFlows }) => {
  for (const name of created) {
    try {
      await inventoryFlows.discardIfPresent(name);
    } catch {
      // Best effort: the original failure is what the report shows.
    }
  }
  created.clear();
});

test(
  'NAKIVO Inventory item page of a Read-Scale availability group shows a database icon next to every listed database',
  { tag: '@NJM-159748' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const obs = new ObsBFlows(page);
    const name = LAB_ITEMS.readScale;

    await test.step('1. Precondition: the discovered Read-Scale availability group is listed in the Inventory', async () => {
      if (await listedInInventory(flows, name)) return;
      created.add(name);
      const outcome = await addReadScaleItem(flows, { displayName: name, ...target });
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, `adding the Read-Scale AG "${name}" did not complete discovery`).toBe('added');
    });

    await test.step('2. Open Settings > Inventory: the Inventory page lists the discovered items', async () => {
      await flows.gotoInventory();
      await expect(inventoryPage.item(name)).toBeVisible();
    });

    await test.step('3. Select the Read-Scale AG item and open its page: the item page is displayed', async () => {
      await flows.openItem(name);
      await expect(obs.healthBadge()).toBeVisible();
      await expect(inventoryItemPage.detail('Type:')).toHaveText('Microsoft SQL Server Read-Scale availability group');
    });

    await test.step('4. The list of databases discovered under the item is displayed', async () => {
      await expect(obs.databaseIcons().first()).toBeVisible();
      const total = ((await inventoryItemPage.detail('Total databases:').textContent({ timeout: 30_000 })) ?? '').trim();
      expect(total).toMatch(/^[1-9]\d*$/);
      await expect(obs.databaseIcons()).toHaveCount(Number(total));
    });

    await test.step('5. Every database entry shows its database icon (rendered, not broken)', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-159748 step 5: the icon asset SQLD003 is not identifiable; the observed database icon class, size and image are asserted and the image file is requested.' });
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
