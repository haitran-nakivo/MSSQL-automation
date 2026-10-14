import { test, expect } from '../../../../../fixtures';

const FCI_TYPE = 'Microsoft SQL Server failover cluster instance';

// Xray: NJM-154526 "Verify adding SQL Failover Cluster to Inventory".
test(
  'NAKIVO user can add a Microsoft SQL Server failover cluster instance to Inventory',
  { tag: ['@NJM-154526'] },
  async ({ page, signedIn, inventoryPage, addInventoryItemPage, inventoryItemPage, mssqlFciTarget }, testInfo) => {
    // Adding a cluster runs discovery on the Director; an availability group took 1.5 to 4 minutes when observed.
    test.setTimeout(480_000);
    // Assumed naming, mirroring the availability group test (AAG-<host>); not given by the owner.
    const displayName = `FCI-${mssqlFciTarget.host}`;

    await inventoryPage.goto();
    await inventoryPage.openAddWizard();
    await expect(addInventoryItemPage.title).toBeVisible();

    await addInventoryItemPage.chooseApplication();
    await addInventoryItemPage.next();
    await addInventoryItemPage.chooseType(FCI_TYPE);
    await expect(addInventoryItemPage.typeField).toHaveValue(FCI_TYPE);

    await addInventoryItemPage.fillFailoverCluster({ displayName, ...mssqlFciTarget });
    await addInventoryItemPage.finish();

    // The wizard closes at once (it stays open when the Director rejects the entry, for example as a duplicate).
    await expect(addInventoryItemPage.title).toBeHidden();

    // The item is listed while it is being added, then discovery completes without a failure.
    await expect(inventoryPage.item(displayName)).toBeVisible();
    await expect(inventoryPage.addingIndicator).toBeHidden({ timeout: 360_000 });
    await expect(inventoryPage.failedBadge).toBeHidden();
    await testInfo.attach('evidence-1-inventory-list-after-add', { body: await page.screenshot(), contentType: 'image/png' });

    // The item page confirms what was added.
    await inventoryPage.openItem(displayName);
    await expect(inventoryItemPage.text(FCI_TYPE)).toBeVisible();
    await expect(inventoryItemPage.noIssues).toBeVisible();
    await testInfo.attach('evidence-2-item-page', { body: await page.screenshot(), contentType: 'image/png' });
  },
);
