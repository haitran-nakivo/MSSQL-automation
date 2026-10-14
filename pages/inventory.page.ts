import type { Locator, Page } from '@playwright/test';

// Settings > Inventory list. Evidence: workspace/phase4/mssql-ag-add-learning.md (live inspection on NBR #2, v11.2.1.112232).
// These locators are NOT yet recorded in a reviewed knowledge document (see the evidence file).
export class InventoryPage {
  private static readonly route = '/c/configuration';

  readonly addingIndicator: Locator;
  readonly failedBadge: Locator;

  private readonly inventoryTab: Locator;
  private readonly addButton: Locator;

  constructor(private readonly page: Page) {
    this.inventoryTab = page.locator('.tabInventory').getByText('Inventory', { exact: true });
    this.addButton = page.locator('.add-btn').filter({ visible: true });
    this.addingIndicator = page.getByText('Adding...');
    this.failedBadge = page.getByText('Failed', { exact: true });
  }

  // Opens Settings > Inventory and returns when the list has loaded, so a "is X listed?" read right after it is meaningful.
  async goto(): Promise<void> {
    await this.page.goto(InventoryPage.route);
    await this.inventoryTab.click();
    await this.addButton.waitFor();
    await this.listLoaded();
  }

  // The grid is filled after the tab opens (observed 2026-10-13: 0 rows, then all rows about 0.2 s later, no loading mask), so the
  // first row is the "loaded" signal. An Inventory with no items never shows a row; that costs the timeout once and is not an error.
  async listLoaded(timeoutMs = 15_000): Promise<void> {
    await this.page.locator('.x-grid-row').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: timeoutMs }).catch((error: { name?: string }) => {
      if (error?.name !== 'TimeoutError') throw error;
    });
  }

  async openAddWizard(): Promise<void> {
    await this.addButton.click();
  }

  // Inventory rows currently listed (Ext grid rows; not yet recorded in reviewed knowledge).
  // The list loads after the page does, so the count is read until two reads a second apart agree.
  async itemCount(): Promise<number> {
    const rows = this.page.locator('.x-grid-row').filter({ visible: true });
    let previous = await rows.count();
    for (let attempt = 0; attempt < 10; attempt++) {
      await this.page.waitForTimeout(1000);
      const current = await rows.count();
      if (current === previous && current > 0) return current;
      previous = current;
    }
    return previous;
  }

  // True when some listed item's name contains the host (the name is the Display name, or the host when none was given).
  async hasItemFor(host: string): Promise<boolean> {
    await this.listLoaded();
    return (await this.page.getByText(host).filter({ visible: true }).count()) > 0;
  }

  // The name as listed in the Inventory grid. The same name can also appear outside the grid (a second link with the
  // item's name was seen on the page), so the match is limited to the grid rows.
  item(displayName: string): Locator {
    return this.row(displayName).getByText(displayName, { exact: true });
  }

  // The grid row whose item name is exactly displayName (not a longer name that merely contains it).
  row(displayName: string): Locator {
    return this.page
      .locator('.x-grid-row')
      .filter({ visible: true })
      .filter({ has: this.page.getByText(displayName, { exact: true }) });
  }

  // The row's Details once discovery has finished, for example "2 hosts, 6 databases" (counts are not asserted).
  completedDetails(displayName: string): Locator {
    return this.row(displayName).getByText(/\d+ hosts?, \d+ databases?/);
  }

  // The row's Details once discovery has produced a database count, whatever the item type ("<n> databases").
  discoveredDetails(displayName: string): Locator {
    return this.row(displayName).getByText(/\d+ databases?/);
  }

  async openItem(displayName: string): Promise<void> {
    await this.item(displayName).click();
  }
}
