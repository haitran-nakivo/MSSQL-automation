import type { Locator, Page } from '@playwright/test';

// The detail page of one Inventory item (opened by selecting its row).
// Evidence: workspace/phase4/mssql-ag-add-learning.md.
export class InventoryItemPage {
  readonly noIssues: Locator;
  // The confirmation shown by Remove ("Remove the host?"), with the three choices for the transporter on the host.
  readonly removeDialog: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.noIssues = page.getByText('No Issues', { exact: true });
    this.removeDialog = page.locator('.x-window').filter({ hasText: 'Remove the host?' });
  }

  // The item page's Edit button (the only visible "Edit" text on the page).
  async edit(): Promise<void> {
    await this.page.getByText('Edit', { exact: true }).filter({ visible: true }).click();
  }

  // The trash button must be clicked as the icon element: a role/text click on "Remove" opened no confirmation in earlier probes.
  // A click made right after the item page opens can be lost, so it is repeated until the dialog shows.
  async openRemoveDialog(): Promise<void> {
    const trash = this.page.locator('.icon-remove').filter({ visible: true }).first();
    for (let attempt = 1; ; attempt++) {
      await trash.click();
      try {
        await this.removeDialog.waitFor({ state: 'visible', timeout: 3_000 });
        return;
      } catch (error) {
        if (attempt >= 5) throw error;
      }
    }
  }

  // One of the transporter choices listed in the Remove dialog.
  removeChoice(text: string): Locator {
    return this.removeDialog.getByText(text, { exact: true });
  }

  async cancelRemove(): Promise<void> {
    await this.removeDialog.getByText('Cancel', { exact: true }).click();
  }

  // Removes the host from Inventory with the given transporter choice (the option's text), then confirms with Remove.
  async remove(choice: string): Promise<void> {
    await this.removeChoice(choice).click();
    await this.removeDialog.getByText('Remove', { exact: true }).click();
  }

  // The value shown next to a label in General information / Instance details ("Operating system", "SQL version:",
  // "Total databases:", "AG name:"). The value is the label's next sibling element.
  detail(label: string): Locator {
    return this.page.getByText(label, { exact: true }).filter({ visible: true }).locator('xpath=following-sibling::*[1]');
  }

  text(value: string): Locator {
    // The Inventory list stays in the page behind the item page, so only the visible match counts.
    return this.page.getByText(value, { exact: true }).filter({ visible: true });
  }
}
