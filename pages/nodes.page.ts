import type { Locator, Page } from '@playwright/test';

// Settings > Nodes list (transporters and agents). Evidence: workspace/phase4/mssql-ag-remove-cases.md (read-only look on
// 2026-10-06). Not yet recorded in a reviewed knowledge document; the locators follow the Inventory page's.
export class NodesPage {
  private static readonly route = '/c/configuration';

  private readonly nodesTab: Locator;

  constructor(private readonly page: Page) {
    this.nodesTab = page.locator('.tabNodes').getByText('Nodes', { exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto(NodesPage.route);
    await this.nodesTab.click();
    await this.rows.first().waitFor();
  }

  private get rows(): Locator {
    return this.page.locator('.x-grid-row').filter({ visible: true });
  }

  // The node row whose name is exactly `name` (a machine agent is named after its host).
  node(name: string): Locator {
    return this.rows.filter({ has: this.page.getByText(name, { exact: true }) });
  }

  // The names of all listed nodes (the first line of each row).
  async nodeNames(): Promise<string[]> {
    return (await this.rows.allInnerTexts()).map((row) => row.split('\n')[0].trim());
  }
}
