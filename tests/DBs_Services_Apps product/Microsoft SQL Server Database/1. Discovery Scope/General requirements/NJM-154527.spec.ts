import { test, expect } from '../../../../../fixtures';

// Xray: NJM-154527 "Verify adding Always On Availability Group to Inventory".
test(
  'NAKIVO user can add a Microsoft SQL Server Always On availability group to Inventory',
  { tag: ['@NJM-154527'] },
  async ({ page, signedIn, inventoryPage, addInventoryItemPage, inventoryItemPage, mssqlAgTarget }, testInfo) => {
    // Adding an availability group runs discovery on the Director; it took 1.5 to 3 minutes when observed.
    test.setTimeout(480_000);
    const displayName = `AAG-${mssqlAgTarget.host}`;

    await inventoryPage.goto();
    await inventoryPage.openAddWizard();
    await expect(addInventoryItemPage.title).toBeVisible();

    await addInventoryItemPage.chooseApplication();
    await addInventoryItemPage.next();
    await expect(addInventoryItemPage.typeField).toHaveValue('Microsoft SQL Server Always On availability group');

    await addInventoryItemPage.fillAvailabilityGroup({ displayName, ...mssqlAgTarget });
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
    await expect(inventoryItemPage.text(mssqlAgTarget.agName)).toBeVisible();
    await expect(inventoryItemPage.text('Microsoft SQL Server Always On availability group')).toBeVisible();
    await expect(inventoryItemPage.noIssues).toBeVisible();
    await testInfo.attach('evidence-2-item-page', { body: await page.screenshot(), contentType: 'image/png' });
  },
);
