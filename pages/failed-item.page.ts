import type { Locator, Page } from '@playwright/test';

// The Inventory row of an item whose add ended "Failed", and its "Show error" dialog.
// Observed on Director 11.2.1.112232 (2026-10-08, live inspection; not yet in a reviewed knowledge document):
// - a Failed row is greyed out and cannot be opened (clicks are intercepted), but its row "..." menu (`.more-horizontal-btn`,
//   shown on hover) has three entries: Show error, Retry (opens Edit) and Cancel (removes the item from Inventory, owner-stated);
// - Show error opens a dialog titled "Cannot add the Microsoft SQL Server ..." with the reason and a Close button.
export class FailedItemPage {
  readonly errorDialog: Locator;

  constructor(private readonly page: Page) {
    this.errorDialog = page.locator('.x-window').filter({ visible: true }).filter({ hasText: 'Cannot add the' });
  }

  private row(name: string): Locator {
    return this.page
      .locator('.x-grid-row')
      .filter({ visible: true })
      .filter({ has: this.page.getByText(name, { exact: true }) });
  }

  // The row's "..." menu button appears on hover and is covered by the disabled grid, so it is clicked with force.
  async openMenu(name: string): Promise<void> {
    const row = this.row(name);
    await row.hover();
    await row.locator('.more-horizontal-btn').click({ force: true, timeout: 10_000 });
  }

  private menuItem(text: 'Show error' | 'Retry' | 'Cancel'): Locator {
    return this.page.getByText(text, { exact: true }).filter({ visible: true });
  }

  async showError(name: string): Promise<void> {
    await this.openMenu(name);
    await this.menuItem('Show error').click({ timeout: 10_000 });
    await this.errorDialog.waitFor({ timeout: 30_000 });
  }

  async closeError(): Promise<void> {
    await this.errorDialog.getByText('Close', { exact: true }).click({ timeout: 10_000 });
  }

  // "Cancel" in the row menu: removes the failed item from Inventory.
  async cancelItem(name: string): Promise<void> {
    await this.openMenu(name);
    await this.menuItem('Cancel').click({ timeout: 10_000 });
  }
}
