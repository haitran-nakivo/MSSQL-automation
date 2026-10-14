import type { TestInfo } from '@playwright/test';
import { test, expect, type InventorySession } from '../../../../fixtures';

// Ordered lifecycle of one Microsoft SQL Server Read-Scale availability group in Inventory, in one browser session:
// 1. Add (happy case; no Xray key given, so none is tagged)  2. Edit its Display name  3. Delete it (keeping the transporter).
// The tests depend on each other by design (serial). Display name `RSAG-<host>` is assumed (not given by the owner).
// Evidence: workspace/phase4/mssql-readscale-lifecycle.md.
test.describe.configure({ mode: 'serial' });

const READSCALE_TYPE = 'Microsoft SQL Server Read-Scale availability group';
const KEEP_TRANSPORTER = 'Remove host and keep transporter';

test.describe('Microsoft SQL Server Read-Scale availability group in Inventory: add, edit, delete', () => {
  test('1. NAKIVO user can add a Microsoft SQL Server Read-Scale availability group to Inventory', async ({
    inventorySession: { page, inventoryPage, addInventoryItemPage, inventoryItemPage, mssqlReadScaleTarget },
  }, testInfo) => {
    test.setTimeout(900_000);
    const displayName = `RSAG-${mssqlReadScaleTarget.host}`;

    await test.step('Precondition: no Inventory item with this name exists (the Director rejects duplicates)', async () => {
      await inventoryPage.goto();
      if ((await inventoryPage.row(displayName).count()) > 0) {
        await inventoryPage.openItem(displayName);
        await inventoryItemPage.openRemoveDialog();
        await inventoryItemPage.remove(KEEP_TRANSPORTER);
        await inventoryPage.goto();
        await expect(inventoryPage.item(displayName)).toHaveCount(0, { timeout: 120_000 });
      }
    });

    await inventoryPage.openAddWizard();
    await expect(addInventoryItemPage.title).toBeVisible();
    await addInventoryItemPage.chooseApplication();
    await addInventoryItemPage.next();
    await addInventoryItemPage.chooseType(READSCALE_TYPE);
    await expect(addInventoryItemPage.typeField).toHaveValue(READSCALE_TYPE);
    await addInventoryItemPage.fillAvailabilityGroup({ displayName, ...mssqlReadScaleTarget });
    await addInventoryItemPage.finish();

    // The wizard closes at once (it stays open when the Director rejects the entry, for example as a duplicate).
    await expect(addInventoryItemPage.title).toBeHidden();
    await expect(inventoryPage.item(displayName)).toBeVisible();

    // Discovery is complete when the row shows a database count; it must not end as Failed.
    await expect(inventoryPage.discoveredDetails(displayName)).toBeVisible({ timeout: 600_000 });
    await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
    await testInfo.attach('evidence-1-inventory-list-after-add', { body: await page.screenshot(), contentType: 'image/png' });

    await inventoryPage.openItem(displayName);
    await expect(inventoryItemPage.text(READSCALE_TYPE)).toBeVisible();
    await expect(inventoryItemPage.text(mssqlReadScaleTarget.agName)).toBeVisible();
    await expect(inventoryItemPage.noIssues).toBeVisible();
    await testInfo.attach('evidence-2-item-page', { body: await page.screenshot(), contentType: 'image/png' });
  });

  test('2. NAKIVO user can edit the Display name of the Read-Scale availability group item', async ({
    inventorySession: { page, inventoryPage, inventoryItemPage, editInventoryItemPage, mssqlReadScaleTarget },
  }, testInfo) => {
    test.setTimeout(600_000);
    const original = `RSAG-${mssqlReadScaleTarget.host}`;
    const edited = `${original}-edited`;

    async function rename(from: string, to: string): Promise<void> {
      await inventoryPage.goto();
      await inventoryPage.openItem(from);
      await inventoryItemPage.edit();
      await expect(editInventoryItemPage.displayNameField).toHaveValue(from);
      await editInventoryItemPage.setDisplayName(to);
      await editInventoryItemPage.save();
      await expect(editInventoryItemPage.displayNameField).toBeHidden();

      await inventoryPage.goto();
      await expect(inventoryPage.item(to)).toBeVisible();
      await expect(inventoryPage.item(from)).toHaveCount(0);
      await expect(inventoryPage.row(to).getByText('Failed', { exact: true })).toBeHidden();
    }

    await rename(original, edited);
    await testInfo.attach('evidence-edit-list-after-edit', { body: await page.screenshot(), contentType: 'image/png' });
    await inventoryPage.openItem(edited);
    await expect(inventoryItemPage.text(mssqlReadScaleTarget.agName)).toBeVisible();
    await expect(inventoryItemPage.noIssues).toBeVisible();
    await testInfo.attach('evidence-edit-item-page', { body: await page.screenshot(), contentType: 'image/png' });

    // Restore the original name so the item is left as the Add step created it.
    await rename(edited, original);
    await expect(inventoryPage.discoveredDetails(original)).toBeVisible({ timeout: 300_000 });
  });

  test('3. Delete: "Remove host and keep transporter" removes the item and keeps the nodes', async ({
    inventorySession: { page, inventoryPage, inventoryItemPage, nodesPage, mssqlReadScaleTarget },
  }, testInfo) => {
    test.setTimeout(600_000);
    const itemName = `RSAG-${mssqlReadScaleTarget.host}`;

    await nodesPage.goto();
    const nodesBefore = await nodesPage.nodeNames();
    await inventoryPage.goto();
    const itemCountBefore = await inventoryPage.itemCount();
    const otherItems = (await page.locator('.x-grid-row').filter({ visible: true }).allInnerTexts())
      .map((row) => row.split('\n')[0].trim())
      .filter((name) => name !== itemName);
    await expect(inventoryPage.item(itemName)).toBeVisible();

    await inventoryPage.openItem(itemName);
    await inventoryItemPage.openRemoveDialog();
    await expect(inventoryItemPage.removeDialog).toBeVisible();
    await testInfo.attach('evidence-remove-dialog', { body: await page.screenshot(), contentType: 'image/png' });
    await inventoryItemPage.remove(KEEP_TRANSPORTER);
    await expect(inventoryItemPage.removeDialog).toBeHidden();

    await inventoryPage.goto();
    await expect(inventoryPage.item(itemName)).toHaveCount(0, { timeout: 120_000 });
    expect(await inventoryPage.itemCount()).toBe(itemCountBefore - 1);
    for (const other of otherItems) {
      await expect(inventoryPage.item(other)).toBeVisible();
    }
    await testInfo.attach('evidence-inventory-after-delete', { body: await page.screenshot(), contentType: 'image/png' });

    // "Keep transporter": no node is removed.
    await nodesPage.goto();
    expect((await nodesPage.nodeNames()).sort()).toEqual([...nodesBefore].sort());
  });
});
