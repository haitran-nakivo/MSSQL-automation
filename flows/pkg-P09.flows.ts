import type { Locator, Page } from '@playwright/test';

// Reads of the Inventory item page for the package "1.3. Inventory Item Details" (see standards/flows-layer.md).
// Nothing here asserts: every method returns what it saw and the test decides. Nothing reads .env or credentials.

// Names of the items that already stand in the lab Inventory (Observed 2026-10-10). The tests only read these items.
export const LAB_ITEMS = {
  instance: 'WS2022-SQL2025-19.145', // standalone instance on 10.10.19.145 (the host of mssqlInstanceTarget)
  failoverCluster: 'FCI-33.140', // FCI on 10.10.33.140 (the host of mssqlFciTarget), Inaccessible today
  alwaysOn: 'AAG-36.6', // Always On AG on 10.10.36.6, AG AG_TESTDB86
} as const;

// A text on the page, as the browser lays it out (CSS pixels, page coordinates of the viewport).
export interface TextBox {
  text: string;
  found: boolean;
  top: number;
  left: number;
  right: number;
  bottom: number;
  // The element's content is wider or higher than the element itself (the text is cut off).
  clipped: boolean;
  // The element lies completely inside the browser window.
  insideViewport: boolean;
}

export interface IconProbe {
  found: boolean;
  // Tag, class and image source of the icon element that stands before the item name (empty when none was found).
  descriptor: string;
}

export class P09Flows {
  constructor(private readonly page: Page) {}

  private visibleText(text: string): Locator {
    return this.page.getByText(text, { exact: true }).filter({ visible: true });
  }

  // Position and clipping of the first visible element whose whole text is `text`.
  async measure(text: string): Promise<TextBox> {
    const target = this.visibleText(text).first();
    if ((await target.count()) === 0) return { text, found: false, top: 0, left: 0, right: 0, bottom: 0, clipped: false, insideViewport: false };
    const box = await target.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
        insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
      };
    });
    return { text, found: true, ...box };
  }

  async measureAll(texts: readonly string[]): Promise<TextBox[]> {
    const boxes: TextBox[] = [];
    for (const text of texts) boxes.push(await this.measure(text));
    return boxes;
  }

  // Names of the pairs of found texts whose rectangles intersect (an empty list means no overlap).
  overlappingPairs(boxes: readonly TextBox[]): string[] {
    const found = boxes.filter((box) => box.found);
    const pairs: string[] = [];
    for (let i = 0; i < found.length; i++) {
      for (let j = i + 1; j < found.length; j++) {
        const a = found[i];
        const b = found[j];
        const intersects = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        if (intersects) pairs.push(`"${a.text}" overlaps "${b.text}"`);
      }
    }
    return pairs;
  }

  // The smallest element that holds both section headings "General information" and "Instance details" (used for screenshots).
  detailsContainer(): Locator {
    return this.page
      .locator('xpath=(//*[descendant::*[normalize-space(text())="General information"] and descendant::*[normalize-space(text())="Instance details"]])[last()]')
      .filter({ visible: true });
  }

  // The value next to the label whose text is `label` (the label's next sibling element, the same rule as InventoryItemPage.detail).
  // Returns null when the label is not on the page.
  async readValueByLabel(label: RegExp): Promise<string | null> {
    const value = this.page.getByText(label).filter({ visible: true }).locator('xpath=following-sibling::*[1]').first();
    if ((await value.count()) === 0) return null;
    return ((await value.textContent({ timeout: 10_000 })) ?? '').trim();
  }

  // Looks for an icon element in the header, on the same line as the item name and to the left of it: an element without text, 8 to 64 px
  // in size, that is an img/svg/i, carries an "icon" class, or has a background/mask image. Describes it so a run can record it.
  async probeTitleIcon(itemName: string): Promise<IconProbe> {
    const names = this.visibleText(itemName);
    const total = await names.count();
    for (let index = 0; index < total; index++) {
      const descriptor = await names.nth(index).evaluate((nameEl) => {
        const nameRect = nameEl.getBoundingClientRect();
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
          if (el === nameEl || nameEl.contains(el) || el.contains(nameEl)) continue;
          if ((el.textContent ?? '').trim() !== '') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 8 || rect.height < 8 || rect.width > 64 || rect.height > 64) continue;
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none') continue;
          const tag = el.tagName.toLowerCase();
          const cls = typeof el.className === 'string' ? el.className : '';
          const hasImage = style.backgroundImage !== 'none' || (style.maskImage !== undefined && style.maskImage !== 'none' && style.maskImage !== '');
          if (!(tag === 'img' || tag === 'svg' || tag === 'i' || /icon/i.test(cls) || hasImage)) continue;
          const sameLine = rect.top < nameRect.bottom && rect.bottom > nameRect.top;
          const before = rect.right <= nameRect.left + 4 && rect.right >= nameRect.left - 120;
          if (sameLine && before) return `${tag}.${cls} ${el.getAttribute('src') ?? ''} ${style.backgroundImage}`.trim();
        }
        return '';
      });
      if (descriptor !== '') return { found: true, descriptor };
    }
    return { found: false, descriptor: '' };
  }
}

// A case-insensitive exact-match pattern for a text taken from the environment.
export function exactIgnoreCase(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}
