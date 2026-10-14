import type { Page } from '@playwright/test';

// Helper flows for package P03 (Platform step and Inventory table specs in tests/DBs_Services_Apps product/Microsoft SQL Server Database/1. Discovery Scope).
// Same rules as standards/flows-layer.md: no assertions, no .env, returns what it saw, waits only on observable state.

export const ALWAYS_ON_TYPE = 'Microsoft SQL Server Always On availability group';

// One row of the Inventory table: the three columns (Inventory item, Item Type, Details) and the state badges of the row.
export interface InventoryRow {
  name: string;
  type: string;
  details: string;
  failed: boolean;
  inaccessible: boolean;
}

// Which topology a row is meant to show. The matchers are deliberately looser than the exact Item Type text, so that a spec can
// still assert the exact text of the row it picked (a row picked by its exact text could not fail on that text).
export type RowKind = 'instance' | 'failoverCluster' | 'alwaysOn' | 'readScale';

const KIND_MATCHERS: Record<RowKind, (type: string) => boolean> = {
  instance: (type) => /instance/i.test(type) && !/failover/i.test(type),
  failoverCluster: (type) => /failover cluster/i.test(type),
  alwaysOn: (type) => /always on/i.test(type),
  readScale: (type) => /read-scale/i.test(type),
};

export function rowOfKind(rows: InventoryRow[], kind: RowKind): InventoryRow | null {
  return rows.find((row) => KIND_MATCHERS[kind](row.type)) ?? null;
}

export function isSqlRow(row: InventoryRow): boolean {
  return /^Microsoft SQL Server/.test(row.type);
}

// A graphic found in the part of a row that is left of the Item Type column (where the item's icon is).
export interface RowGraphic {
  kind: string;
  source: string;
  left: number;
  right: number;
  width: number;
  height: number;
}

export class Pkg03Flows {
  constructor(private readonly page: Page) {}

  // Every visible row of the Inventory table (call after the list has loaded).
  async readAllRows(): Promise<InventoryRow[]> {
    const texts = await this.page.locator('.x-grid-row').filter({ visible: true }).allInnerTexts();
    return texts.map((text) => {
      const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
      return {
        name: lines[0] ?? '',
        type: lines[1] ?? '',
        details: lines[2] ?? '',
        failed: lines.includes('Failed'),
        inaccessible: lines.includes('Inaccessible'),
      };
    });
  }

  // The column headers that are visible, left to right, each with its horizontal position (null when a header is not found).
  async headerOrder(labels: string[]): Promise<{ label: string; x: number | null }[]> {
    const found: { label: string; x: number | null }[] = [];
    for (const label of labels) {
      const header = this.page.getByText(label, { exact: true }).filter({ visible: true }).first();
      const box = (await header.count()) > 0 ? await header.boundingBox({ timeout: 10_000 }) : null;
      found.push({ label, x: box ? box.x : null });
    }
    return found.sort((a, b) => (a.x ?? Number.MAX_SAFE_INTEGER) - (b.x ?? Number.MAX_SAFE_INTEGER));
  }

  // Left edge of the Item Type header, or null.
  async itemTypeHeaderX(): Promise<number | null> {
    const header = this.page.getByText('Item Type', { exact: true }).filter({ visible: true }).first();
    if ((await header.count()) === 0) return null;
    const box = await header.boundingBox();
    return box ? box.x : null;
  }

  // Left edge and right edge of the item name text of a row (the exact name), or null.
  async nameBox(name: string): Promise<{ left: number; right: number } | null> {
    const item = this.page.locator('.x-grid-row').filter({ visible: true }).filter({ has: this.page.getByText(name, { exact: true }) }).getByText(name, { exact: true }).first();
    if ((await item.count()) === 0) return null;
    const box = await item.boundingBox();
    return box ? { left: box.x, right: box.x + box.width } : null;
  }

  // A probe of what graphic the row draws left of the Item Type column: <img>, <svg>, a CSS background image, or a ::before / ::after
  // with drawn content. The DOM form of the row icon is not recorded in the project knowledge, so any of these counts; the result
  // (kind and source) is what the owner can record as the icon baseline. Row-wide gradients are ignored.
  async rowGraphics(name: string, limitX: number): Promise<RowGraphic[]> {
    const row = this.page.locator('.x-grid-row').filter({ visible: true }).filter({ has: this.page.getByText(name, { exact: true }) }).first();
    return row.evaluate((rowElement, limit) => {
      const found: { kind: string; source: string; left: number; right: number; width: number; height: number }[] = [];
      for (const element of Array.from(rowElement.querySelectorAll('*'))) {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || rect.left >= limit) continue;
        const tag = element.tagName.toLowerCase();
        const cls = (element.getAttribute('class') ?? '').trim();
        const base = { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
        if (tag === 'img') found.push({ kind: 'img', source: (element as HTMLImageElement).currentSrc || (element.getAttribute('src') ?? ''), ...base });
        if (tag === 'svg') found.push({ kind: 'svg', source: cls, ...base });
        const style = getComputedStyle(element);
        if (style.backgroundImage !== 'none' && !style.backgroundImage.includes('gradient')) found.push({ kind: 'background-image', source: `${cls} | ${style.backgroundImage}`, ...base });
        for (const pseudo of ['::before', '::after']) {
          const ps = getComputedStyle(element, pseudo);
          const drawn = ps.display !== 'none' && parseFloat(ps.width) > 0 && parseFloat(ps.height) > 0;
          const hasContent = ps.content !== 'none' && ps.content !== 'normal' && ps.content !== '""' && ps.content !== "''";
          const hasImage = ps.backgroundImage !== 'none' && !ps.backgroundImage.includes('gradient');
          if (drawn && (hasImage || hasContent)) found.push({ kind: pseudo, source: `${cls} | ${hasImage ? ps.backgroundImage : ps.content}`, ...base });
        }
      }
      return found;
    }, limitX);
  }
}
