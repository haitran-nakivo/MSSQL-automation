import type { Locator, Page } from '@playwright/test';

// Reads of the Inventory item page and the Inventory list built from the classes observed on 2026-10-09 (Director 11.2.1.112232).
// Nothing here asserts and nothing reads .env: every method returns what it saw and the spec decides.

export interface DatabaseRow {
  // Text of the element that holds the database icon (the database name).
  name: string;
  // The computed background image of the icon element.
  iconImage: string;
  // Size of the icon element in CSS pixels.
  iconWidth: number;
  iconHeight: number;
  // The row's text is wider than its element (cut off).
  clipped: boolean;
}

export class ObsBFlows {
  constructor(private readonly page: Page) {}

  // ---- item page: health badge and Refresh ----

  // The health badge of the item header: a link button holding the status icon and the "No Issues" / "<n> Issues" link.
  healthBadge(): Locator {
    return this.page.locator('div.link-button.simple-link').filter({ visible: true }).filter({ has: this.page.locator('div.hmIcon') }).first();
  }

  healthBadgeLink(): Locator {
    return this.healthBadge().locator('a.slActive');
  }

  healthBadgeIcon(): Locator {
    return this.healthBadge().locator('div.hmIcon');
  }

  // The Refresh button of the item page.
  refreshButton(): Locator {
    return this.page.locator('div.x-btn.refresh-icon').filter({ visible: true }).first();
  }

  // The "<n> Issues require your attention" heading shown below the header when the item has issues.
  issuesHeading(): Locator {
    return this.page.getByText(/^\d+ Issues? require your attention/).filter({ visible: true }).first();
  }

  // ---- item page: database list ----

  databaseIcons(): Locator {
    return this.page.locator('img.x-tree-icon.iconDbDatabase24').filter({ visible: true });
  }

  // One entry per database row: the name text and what the icon element looks like.
  async readDatabaseRows(): Promise<DatabaseRow[]> {
    return this.databaseIcons().evaluateAll((icons) =>
      icons.map((icon) => {
        const holder = icon.parentElement as HTMLElement;
        const style = getComputedStyle(icon);
        const rect = icon.getBoundingClientRect();
        return {
          name: (holder.textContent ?? '').trim(),
          iconImage: style.backgroundImage,
          iconWidth: Math.round(rect.width),
          iconHeight: Math.round(rect.height),
          clipped: holder.scrollWidth > holder.clientWidth + 1,
        };
      }),
    );
  }

  // Requests the file the first database icon takes its image from; returns the HTTP status (0 when no image URL was found).
  async iconAssetStatus(): Promise<number> {
    const image = await this.databaseIcons().first().evaluate((icon) => getComputedStyle(icon).backgroundImage);
    const url = /url\(["']?([^"')]+?)(?:#[^"')]*)?["']?\)/.exec(image)?.[1];
    if (!url) return 0;
    return this.page.evaluate(async (assetUrl) => (await fetch(assetUrl)).status, url);
  }

  // ---- Inventory list ----

  // A column header of the Inventory grid, by its exact text.
  columnHeader(text: string): Locator {
    return this.page.locator('.x-column-header').filter({ visible: true }).filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });
  }

  // Item names of the visible grid rows in the order they are listed (the first line of each row's text).
  async listedNames(): Promise<string[]> {
    return this.page.locator('.x-grid-row').filter({ visible: true }).evaluateAll((rows) =>
      rows.map((row) => ((row as HTMLElement).innerText.split('\n').map((line) => line.trim()).find((line) => line !== '') ?? '')),
    );
  }

  // Item type texts of the visible grid rows in listed order (the second line of each row's text).
  async listedTypes(): Promise<string[]> {
    return this.page.locator('.x-grid-row').filter({ visible: true }).evaluateAll((rows) =>
      rows.map((row) => ((row as HTMLElement).innerText.split('\n').map((line) => line.trim()).filter((line) => line !== '')[1] ?? '')),
    );
  }

  // ---- Credentials Management dialog ----

  credentialsDialog(): Locator {
    return this.page.locator('.manage-credential-dialog').filter({ visible: true });
  }

  // Opens the drop-down of the OS username combo (index 0) or SQL username combo (index 1) by clicking the arrow just right of the input
  // (nakivo-ui-automation-gotchas: "open by clicking the arrow just right of the input (username); items are .x-boundlist-item").
  async openUsernameDropdown(index: 0 | 1): Promise<void> {
    const input = this.page.locator('input[name="username"]:visible').nth(index);
    const box = await input.boundingBox();
    if (!box) throw new Error('the username input has no layout box');
    await this.page.mouse.click(box.x + box.width + 10, box.y + box.height / 2);
  }

  // An item of an open combo list, by its exact text.
  comboItem(text: string): Locator {
    return this.page.locator('.x-boundlist-item').filter({ visible: true }).getByText(text, { exact: true }).first();
  }
}
