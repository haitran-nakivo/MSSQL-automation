import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';
import { ObsBFlows } from '../../../../../flows/pkg-obsB.flows';

// NJM-154640: "[DBM-Inv-UI-Details-0007] Verify 'X Inaccessible' Count Accuracy".
// Lab preconditions: the failover cluster instance item FCI-33.140 is in Inventory and shows the Inaccessible state (observed 2026-10-09, 28 issues,
//   9 database rows). If the lab state changes (the item becomes accessible) the test fails at step 3.
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 1): NBR 11.2.1 does not show a database count of inaccessible databases; the inaccessible object is the whole FCI item.
// case-vs-ui (step 2): the Inventory page is Settings > Inventory.
// case-vs-ui (step 3): there is no 'X Inaccessible' widget observed in the item page header. The test reads what NBR shows: the Inaccessible badge on the
//   item's Inventory row and the "<n> Issues" badge with the alarm "... is inaccessible".
// case-vs-ui (step 4): no count of inaccessible databases exists to compare; the test checks the item reports the inaccessible state in both places and
//   that the item page still lists its database rows ("Total databases" equals the number of rows).
// case-vs-ui (step 5): not executed (restoring access on the source and a Refresh are not available to the test).
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory shows an inaccessible SQL item as Inaccessible in the list and as an inaccessible alarm on the item page',
  { tag: '@NJM-154640' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const obs = new ObsBFlows(page);
    const name = LAB_ITEMS.failoverCluster;

    await test.step('1. Precondition: the inaccessible SQL item is listed in the Inventory', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154640 step 1: NBR shows the whole FCI item as Inaccessible, not a count of inaccessible databases.' });
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.item(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory view and the details of the item: the item page opens', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154640 step 2: Settings > Inventory.' });
      await expect(inventoryPage.row(name).getByText('Inaccessible', { exact: true })).toBeVisible();
      await flows.openItem(name);
      await expect(obs.healthBadge()).toBeVisible();
    });

    await test.step('3. Read the inaccessible state shown by the item page', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154640 step 3: there is no "X Inaccessible" widget; the page shows the "<n> Issues" badge and the alarm line that the FCI is inaccessible.' });
      await expect(obs.healthBadgeLink()).toHaveText(/^[1-9]\d* Issues$/);
      await expect(page.getByText(`The "${name}" Microsoft SQL Server failover cluster instance is inaccessible`).filter({ visible: true }).first()).toBeVisible();
    });

    await test.step('4. Compare with the actual inaccessible state: the database rows of the item are still listed and match the total', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154640 step 4: no inaccessible-database count exists; the number of database rows is compared with "Total databases".' });
      const total = ((await inventoryItemPage.detail('Total databases:').textContent({ timeout: 30_000 })) ?? '').trim();
      expect(total).toMatch(/^[1-9]\d*$/);
      await expect(obs.databaseIcons()).toHaveCount(Number(total));
    });

    await test.step('5. Restore access to a database and refresh: not executed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154640 step 5: not executed; changing the source and refreshing a pre-existing item is not allowed. The count update is not verified.' });
      await expect(obs.refreshButton()).toBeVisible();
    });
  },
);
