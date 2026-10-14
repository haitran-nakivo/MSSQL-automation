import { test, expect } from '../../../../fixtures';
import type { AvailabilityGroupField } from '../../../../pages/add-inventory-item.page';

// Negative cases for Add Inventory Item > Application > Microsoft SQL Server Always On availability group.
// Evidence: workspace/phase4/mssql-ag-negative-cases.md. Every case here leaves the Director unchanged: the wizard blocks
// Finish (or the Director rejects a duplicate before creating an item), and the item count is checked afterwards.
// All cases share one signed-in browser page (the worker-scoped `inventorySession` fixture); after each case the page
// returns to the Inventory list, which is the starting point of the next case. No Xray key is tagged (none was given).
const requiredFields: { key: AvailabilityGroupField; label: string }[] = [
  { key: 'host', label: 'Hostname or IP' },
  { key: 'osUsername', label: 'OS username' },
  { key: 'agName', label: 'Availability group name' },
  { key: 'sqlUsername', label: 'SQL username' },
];
const optionalFields: AvailabilityGroupField[] = ['displayName', 'osPassword', 'sqlPassword'];

test.describe('Add Microsoft SQL Server Always On availability group to Inventory: negative cases', () => {
  let itemCountBefore: number;
  const pagesSeen = new Set<unknown>();

  // Proves the continuous session: every case must have run on the very same page (one browser, one sign-in).
  test.afterAll(() => {
    expect(pagesSeen.size, 'all negative cases ran on one shared browser page').toBe(1);
  });

  test.beforeEach(async ({ inventorySession: { page, inventoryPage, addInventoryItemPage } }) => {
    pagesSeen.add(page);
    // Clean starting point: the Inventory list (reloaded), then Add > Application > Always On availability group.
    await inventoryPage.goto();
    itemCountBefore = await inventoryPage.itemCount();
    await inventoryPage.openAddWizard();
    await addInventoryItemPage.chooseApplication();
    await addInventoryItemPage.next();
    await expect(addInventoryItemPage.typeField).toHaveValue('Microsoft SQL Server Always On availability group');
  });

  test.afterEach(async ({ inventorySession: { page, inventoryPage } }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      // The shared page has no automatic failure screenshot; the trace is not kept because it records typed passwords.
      await testInfo.attach('failure-screenshot', { body: await page.screenshot(), contentType: 'image/png' });
    }
    // Restore the clean Inventory starting point (this closes the wizard without adding anything).
    await inventoryPage.goto();
  });

  // The rows are not visible while the wizard is open, so the Inventory is reloaded before it is counted again.
  async function expectInventoryUnchanged(inventoryPage: { goto(): Promise<void>; itemCount(): Promise<number> }): Promise<void> {
    await inventoryPage.goto();
    expect(await inventoryPage.itemCount()).toBe(itemCountBefore);
  }

  test('Finish with an empty form is blocked and marks the required fields', async ({ inventorySession: { inventoryPage, addInventoryItemPage } }) => {
    await addInventoryItemPage.finish();

    for (const { key } of requiredFields) {
      await expect(addInventoryItemPage.field(key)).toHaveAttribute('aria-invalid', 'true');
    }
    for (const key of optionalFields) {
      await expect(addInventoryItemPage.field(key)).toHaveAttribute('aria-invalid', 'false');
    }
    await expect(addInventoryItemPage.title).toBeVisible();
    await expectInventoryUnchanged(inventoryPage);
  });

  for (const { key, label } of requiredFields) {
    test(`Finish without ${label} is blocked and marks only that field`, async ({ inventorySession: { inventoryPage, addInventoryItemPage, mssqlAgTarget } }) => {
      await addInventoryItemPage.fillAvailabilityGroup({ displayName: 'AAG-negative-check', ...mssqlAgTarget }, [key]);
      await addInventoryItemPage.finish();

      await expect(addInventoryItemPage.field(key)).toHaveAttribute('aria-invalid', 'true');
      for (const other of requiredFields.filter((f) => f.key !== key)) {
        await expect(addInventoryItemPage.field(other.key)).toHaveAttribute('aria-invalid', 'false');
      }
      await expect(addInventoryItemPage.title).toBeVisible();
      await expectInventoryUnchanged(inventoryPage);
    });
  }

  for (const invalidHost of ['bad host name', '!!!']) {
    test(`Hostname "${invalidHost}" is marked invalid and Finish is blocked`, async ({ inventorySession: { inventoryPage, addInventoryItemPage, mssqlAgTarget } }) => {
      await addInventoryItemPage.fillAvailabilityGroup({ displayName: 'AAG-negative-check', ...mssqlAgTarget, host: invalidHost });
      await expect(addInventoryItemPage.field('host')).toHaveAttribute('aria-invalid', 'true');
      await addInventoryItemPage.finish();

      await expect(addInventoryItemPage.field('host')).toHaveAttribute('aria-invalid', 'true');
      await expect(addInventoryItemPage.title).toBeVisible();
      await expectInventoryUnchanged(inventoryPage);
    });
  }

  // The duplicate case (#8) lives in mssql-availability-group-lifecycle.spec.ts: it needs the item the Add step creates.
});
