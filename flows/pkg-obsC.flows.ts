import type { Page } from '@playwright/test';
import type { InventoryFlows } from './inventory.flows';
import { ObsBFlows } from './pkg-obsB.flows';

// Helpers for the specs that change the SQL Server source (new or renamed database) and then look at the item page.
// No assertions, no .env: each method returns what it saw. (standards/flows-layer.md)

export class ObsCFlows {
  private readonly obsB: ObsBFlows;

  constructor(
    private readonly page: Page,
    private readonly flows: InventoryFlows,
  ) {
    this.obsB = new ObsBFlows(page);
  }

  // Database names listed on the item page that is open now (the rows of the database tree).
  async databaseNamesOnPage(): Promise<string[]> {
    return (await this.obsB.readDatabaseRows()).map((row) => row.name);
  }

  // Clicks Refresh on the open item page. Only call it for an item the test created itself.
  async clickRefresh(): Promise<void> {
    await this.obsB.refreshButton().click({ timeout: 15_000 });
  }

  // Leaves the item page, opens the item again and returns its database names ([] when the list does not show within 30 s).
  // Reopening is what makes the page show the result of a finished refresh.
  async reopenAndReadDatabases(itemName: string): Promise<string[]> {
    await this.flows.gotoInventory();
    await this.flows.openItem(itemName);
    try {
      await this.obsB.databaseIcons().first().waitFor({ state: 'visible', timeout: 30_000 });
    } catch (error) {
      if ((error as { name?: string } | null)?.name !== 'TimeoutError') throw error;
      return [];
    }
    return this.databaseNamesOnPage();
  }
}
