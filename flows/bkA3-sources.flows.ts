import type { Browser, Locator, Page } from '@playwright/test';
import { viewingPause } from '../helpers/viewing-pause';
import { BkA3SourcesPage } from '../pages/bkA3-sources.page';
import { InventoryPage } from '../pages/inventory.page';
import { LoginPage } from '../pages/login.page';
import { OverviewPage } from '../pages/overview.page';
import { BackupFlows } from './backup.flows';

// Flows of the "Step 1 - Sources" cases (assignment A3): read the source tree and the right panel, drive search / expand / select / remove,
// read the license label, compare the tree order with the Inventory, run a single-database backup. No assertions, no .env, no fixed waits
// (standards/flows-layer.md); the specs assert and own the test data.
//
// Facts used: Observed (knowledge/workflows/backup/backup-job-wizard.md): Step 1 lists every Inventory item with its databases (no tempdb);
// ticking an item ticks all its databases and the right panel says "N item(s) were added to this job..."; with nothing ticked it says "Select
// at least one item on the left"; Next with no source stays on Step 1; search filters by database name.
// UNVERIFIED (inferred, never seen live): see pages/bkA3-sources.page.ts (tree classes, icons, expander, remove control, license label,
// "No matching items" text). Where a read depends on such a guess the method says so.

export interface TreeNode {
  name: string;
  /** 0 for the top level, 1 for children, ... (rank of the text's left edge among the tree's distinct left edges). */
  depth: number;
  checked: boolean;
  /** The row carries the "selected" / "focused" styling class. */
  highlighted: boolean;
  /** Icon description: class names (generic Ext ones removed), background image or src. Empty when no icon element was found. */
  iconSignature: string;
  hasExpander: boolean;
}

export interface LicenseLabel {
  /** Visible license text near the label, normalised; empty when no element mentions a license. */
  text: string;
  /** Description of an icon-like element next to the label (img src, background image or class); empty when none. */
  iconSignature: string;
}

export interface Expiry {
  value: number;
  unit: 'days' | 'hours';
}

export interface Session {
  page: Page;
  flows: BackupFlows;
  close: () => Promise<void>;
}

export class BkA3SourcesFlows {
  readonly backup: BackupFlows;
  readonly sources: BkA3SourcesPage;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.backup = new BackupFlows(page);
    this.sources = new BkA3SourcesPage(page);
  }

  // ---- open / leave ----

  // Opens the wizard on Step 1 and waits until the tree shows rows (the Inventory items load after the wizard opens).
  async openStep1(): Promise<void> {
    await this.backup.openWizard();
    await this.sources.treeRows().first().waitFor({ timeout: 30_000 });
  }

  // Cancel; when the Director asks to confirm the discard, confirm it. UNVERIFIED: no confirmation was seen for this wizard.
  async leaveWizard(): Promise<void> {
    await this.backup.cancelWizard();
    const confirm = this.sources.closeConfirmWindow();
    try {
      await confirm.waitFor({ timeout: 3_000 });
    } catch {
      return;
    }
    for (const label of ['Yes', 'Discard', 'Close', 'OK', 'Leave']) {
      const button = confirm.getByText(label, { exact: true });
      if ((await button.count()) > 0) {
        await button.first().click({ timeout: 10_000 });
        return;
      }
    }
  }

  // ---- tree ----

  async readTree(): Promise<TreeNode[]> {
    return this.page.evaluate(() => {
      const visible = (el: HTMLElement) => el.offsetParent !== null;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('.x-grid-row, .x-tree-node')).filter(
        (el) => visible(el) && el.querySelector('[class*=checkbox]'),
      );
      // Keep only innermost rows (a nested tree node would otherwise be counted with its parent).
      const rows = candidates.filter((el) => !candidates.some((other) => other !== el && el.contains(other)));
      const generic = /^(x-|x_)?(tree-icon|tree-icon-leaf|tree-icon-parent|grid-tree-node-.*|tree-expander|tree-elbow.*)$/;
      const nodes = rows.map((row) => {
        const textEl =
          row.querySelector<HTMLElement>('.x-tree-node-text') ??
          Array.from(row.querySelectorAll<HTMLElement>('*')).find((e) => e.children.length === 0 && (e.textContent ?? '').trim() !== '' && !/checkbox/.test(e.className));
        const name = (textEl?.textContent ?? '').replace(/\s+/g, ' ').trim();
        const left = textEl ? Math.round(textEl.getBoundingClientRect().left) : 0;
        const box = row.querySelector<HTMLElement>('[class*=checkbox]');
        const boxClass = box ? String(box.className) : '';
        const input = row.querySelector<HTMLInputElement>('input[type=checkbox]');
        const checked =
          /checked|x-grid-checkcolumn-checked/.test(boxClass) ||
          box?.getAttribute('aria-checked') === 'true' ||
          input?.checked === true ||
          /x-grid-item-checked|checked/.test(String(row.className));
        const iconEl = Array.from(row.querySelectorAll<HTMLElement>('img, [class*=icon]')).find((e) => !/checkbox|expander|elbow/.test(String(e.className)) && e.children.length === 0);
        let iconSignature = '';
        if (iconEl) {
          const bg = getComputedStyle(iconEl).backgroundImage;
          const src = iconEl instanceof HTMLImageElement ? iconEl.src : '';
          const cls = String(iconEl.className)
            .split(/\s+/)
            .filter((c) => c && !generic.test(c))
            .join(' ');
          iconSignature = [src && `src=${src.split('/').pop()}`, bg && bg !== 'none' && `bg=${bg.split('/').pop()}`, cls && `class=${cls}`].filter(Boolean).join(' | ');
        }
        return {
          name,
          left,
          checked: Boolean(checked),
          highlighted: /selected|focused/.test(String(row.className)),
          iconSignature,
          hasExpander: Boolean(row.querySelector('.x-tree-expander, [class*=expander], [class*=elbow-plus], [class*=elbow-minus]')),
        };
      });
      const lefts = Array.from(new Set(nodes.map((n) => n.left))).sort((a, b) => a - b);
      return nodes.map((n) => ({
        name: n.name,
        depth: lefts.indexOf(n.left),
        checked: n.checked,
        highlighted: n.highlighted,
        iconSignature: n.iconSignature,
        hasExpander: n.hasExpander,
      }));
    });
  }

  async visibleRowCount(): Promise<number> {
    return this.sources.treeRows().count();
  }

  async clickCheckbox(name: string, index = 0): Promise<void> {
    await this.sources.checkboxOf(name, index).click({ timeout: 15_000 });
  }

  async clickLabel(name: string, index = 0): Promise<void> {
    await this.sources.labelOf(name, index).click({ timeout: 15_000 });
  }

  async toggleExpander(name: string, index = 0): Promise<void> {
    await this.sources.expanderOf(name, index).click({ timeout: 15_000 });
  }

  // Ticks the box only when it is unchecked now / unticks it only when it is checked (reads the tree before and after nothing else).
  async isChecked(name: string, index = 0): Promise<boolean> {
    const tree = await this.readTree();
    const matches = tree.filter((n) => n.name === name);
    return matches[index]?.checked ?? false;
  }

  // Types into the live search field the way the Ext fields need it (fill() does not reach them).
  async typeSearch(text: string): Promise<void> {
    const field = this.sources.searchField;
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    await field.pressSequentially(text, { delay: 120 });
  }

  async clearSearch(): Promise<void> {
    const field = this.sources.searchField;
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    await field.press('Delete');
  }

  async searchValue(): Promise<string> {
    return this.sources.searchField.inputValue();
  }

  // Is the search field an editable text input?
  async searchEditable(): Promise<boolean> {
    return this.sources.searchField.isEditable();
  }

  // Leaf texts that mention a view / mode switch (List view, Tree view, Inventory view, ...), to prove there is only one view.
  async viewModeTexts(): Promise<string[]> {
    return (await this.backup.visibleTexts()).filter((text) => /\bview\b/i.test(text) && text.length < 40);
  }

  // The vertical overflow of the tree's scrolling container: found from the first tree row upwards.
  async treeScrollInfo(): Promise<{ scrollable: boolean; scrollHeight: number; clientHeight: number }> {
    return this.sources
      .treeRows()
      .first()
      .evaluate((row) => {
        for (let el: HTMLElement | null = row as HTMLElement; el; el = el.parentElement) {
          const style = getComputedStyle(el);
          if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > 0) {
            return { scrollable: el.scrollHeight > el.clientHeight + 1, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
          }
        }
        return { scrollable: false, scrollHeight: 0, clientHeight: 0 };
      });
  }

  // Scrolls the tree's container to its end and returns how far it moved.
  async scrollTreeToEnd(): Promise<number> {
    return this.sources
      .treeRows()
      .first()
      .evaluate((row) => {
        for (let el: HTMLElement | null = row as HTMLElement; el; el = el.parentElement) {
          if (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) {
            el.scrollTop = el.scrollHeight;
            return el.scrollTop;
          }
        }
        return 0;
      });
  }

  // Shrinks the browser window so the tree overflows; false when the window cannot be resized (viewport: null runs).
  async tryShrinkViewport(height: number): Promise<boolean> {
    try {
      await this.page.setViewportSize({ width: 1280, height });
      return true;
    } catch {
      return false;
    }
  }

  // ---- right panel ----

  async summaryText(): Promise<string> {
    return (await this.sources.selectionSummary.innerText()).replace(/\s+/g, ' ').trim();
  }

  // Number of times `name` is shown outside the tree rows (the right panel entry); 0 or 1 expected.
  async paneCount(name: string): Promise<number> {
    return this.page
      .locator(
        `xpath=//*[normalize-space(text())=${xp(name)}][not(ancestor::*[contains(@class,'x-grid-row') or contains(@class,'x-tree-node')][.//*[contains(@class,'checkbox')]])]`,
      )
      .filter({ visible: true })
      .count();
  }

  // Hover the entry, then click its remove (X). UNVERIFIED structure of the right panel.
  async removeFromPane(name: string): Promise<void> {
    await this.sources.paneEntryRow(name).hover({ timeout: 10_000 });
    await this.sources.paneRemoveControl(name).click({ timeout: 10_000 });
  }

  // ---- license label ----

  // The license text in the right panel and an icon-like element beside it. UNVERIFIED: the label's markup was never inspected; the read
  // takes the smallest elements that mention "licen[sc]e" and joins their parent's text (kept when it is short).
  async readLicenseLabel(): Promise<LicenseLabel> {
    return this.page.evaluate(() => {
      const visible = (el: HTMLElement) => el.offsetParent !== null;
      const all = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((el) => visible(el) && /licen[sc]e/i.test(el.textContent ?? ''));
      const deepest = all.filter((el) => !all.some((other) => other !== el && el.contains(other)));
      const texts: string[] = [];
      let icon = '';
      for (const el of deepest) {
        const parent = el.parentElement;
        const parentText = (parent?.innerText ?? '').replace(/\s+/g, ' ').trim();
        const text = parent && parentText.length > 0 && parentText.length < 300 ? parentText : (el.innerText ?? '').replace(/\s+/g, ' ').trim();
        if (text && !texts.includes(text)) texts.push(text);
        if (!icon) {
          const scope = parent ?? el;
          const iconEl = Array.from(scope.querySelectorAll<HTMLElement>('img, [class*=icon], [class*=Icon]')).find((e) => e.offsetParent !== null) ?? (/icon/i.test(String(el.className)) ? el : undefined);
          if (iconEl) {
            const bg = getComputedStyle(iconEl).backgroundImage;
            const src = iconEl instanceof HTMLImageElement ? iconEl.src : '';
            icon = [src && `src=${src.split('/').pop()}`, bg && bg !== 'none' && `bg=${bg.split('/').pop()}`, `class=${String(iconEl.className)}`].filter(Boolean).join(' | ');
          }
        }
      }
      return { text: texts.join(' / '), iconSignature: icon };
    });
  }

  async readRemainingDatabases(): Promise<number | undefined> {
    return BkA3SourcesFlows.parseRemaining((await this.readLicenseLabel()).text);
  }

  // "License: N databases remaining" -> N. Undefined when the text has no such counter.
  static parseRemaining(text: string): number | undefined {
    const match = /(\d+)\s+databases?\s+remaining/i.exec(text);
    return match ? Number(match[1]) : undefined;
  }

  // "License expires in 5 days" / "... in 20 hours" -> { 5, days } / { 20, hours }.
  static parseExpiry(text: string): Expiry | undefined {
    const match = /expires?\s+in\s+(\d+)\s+(days?|hours?)/i.exec(text);
    if (!match) return undefined;
    return { value: Number(match[1]), unit: match[2].toLowerCase().startsWith('day') ? 'days' : 'hours' };
  }

  // True when the license alert offers a way to close it (a close / x-tool control in or beside it). UNVERIFIED markup.
  async alertHasCloseControl(): Promise<boolean> {
    return this.sources.licenseAlert().evaluate((el) => {
      const scope = el.closest('[class*=alert], [class*=msg], [class*=banner], .x-window, .x-panel') ?? el.parentElement ?? el;
      return Boolean(scope.querySelector('[class*=close], .x-tool-close, [class*=dismiss]'));
    });
  }

  // ---- Inventory order ----

  // The Settings > Inventory table, row by row (each row = its trimmed cell lines), in display order.
  async readInventoryRows(): Promise<string[][]> {
    const inventory = new InventoryPage(this.page);
    await inventory.goto();
    await this.page.locator('.x-grid-row:visible').first().waitFor({ timeout: 30_000 });
    return this.page.locator('.x-grid-row:visible').evaluateAll((els) =>
      els.map((el) =>
        ((el as HTMLElement).innerText ?? '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    );
  }

  // Row positions of the given item names in rows read by readInventoryRows; -1 for a name that is not listed.
  static positionsIn(rows: string[][], names: string[]): number[] {
    return names.map((name) => rows.findIndex((cells) => cells.includes(name)));
  }

  // ---- finishing the wizard from Step 1 ----

  // Clicks Next once; true when the wizard reached Step 2 (the Destination label shows), false when it stayed on Step 1.
  async tryNext(): Promise<boolean> {
    await this.backup.next({ blocked: true }); // not known to move yet: the pause is taken below only when it did
    try {
      await this.sources.destinationLabel().waitFor({ timeout: 8_000 });
      await viewingPause();
      return true;
    } catch {
      return false;
    }
  }

  async isOnStep1(): Promise<boolean> {
    return this.sources.selectionSummary.isVisible();
  }

  // Steps 2 to 4 of a minimal job: destination, on demand, name. Leaves the wizard on the Options step.
  async fillToOptions(destination: string, jobName: string): Promise<void> {
    await this.backup.next();
    await this.backup.chooseDestination(destination);
    await this.backup.next();
    await this.backup.setOnDemand();
    await this.backup.next();
    await this.backup.setJobName(jobName);
  }

  // Finish & Run on the Options step: the Run dialog opens and is confirmed.
  async finishAndRun(): Promise<void> {
    await this.backup.wizard.finishAndRunButton.click({ timeout: 10_000 });
    await this.backup.jobs.runDialog.waitFor({ timeout: 15_000 });
    await this.backup.jobs.runDialogRunButton.click({ timeout: 10_000 });
  }

  // The job page after a plain Finish: its status line is visible.
  async waitJobPage(): Promise<void> {
    await this.backup.jobs.statusLine.waitFor({ timeout: 30_000 });
  }

  // ---- a second browser session (an "external" user of the same Director) ----

  async openSession(browser: Browser, baseURL: string, username: string, password: string): Promise<Session> {
    const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(username, password);
    await new OverviewPage(page).logoutMarker.waitFor({ timeout: 60_000 });
    return { page, flows: new BackupFlows(page), close: () => context.close() };
  }

  // ---- individual database backup (cases 171403 / 171405 / 171407 / 171408) ----

  // Step 3 of the case: expand the item and tick one database; returns the tree afterwards.
  async tickSingleDatabase(item: string, database: string): Promise<TreeNode[]> {
    await this.backup.selectSources([{ item, databases: [database] }]);
    return this.readTree();
  }

  // Icon signature of the top-level tree node of each SQL item type ('' when the item is not listed or has no icon; the key is missing from `found` when not listed).
  async readTypeIcons(names: { standalone: string; fci: string; ag: string; readScale: string }): Promise<{ icons: Record<string, string>; missing: string[] }> {
    const tree = await this.readTree();
    const icons: Record<string, string> = {};
    const missing: string[] = [];
    for (const [type, name] of Object.entries(names)) {
      const node = tree.find((n) => n.depth === 0 && n.name === name);
      if (!node) missing.push(name);
      icons[type] = node?.iconSignature ?? '';
    }
    return { icons, missing };
  }

  // Names of the child rows directly under a top-level node (empty when it has none).
  async childrenOf(name: string): Promise<string[]> {
    const tree = await this.readTree();
    const at = tree.findIndex((n) => n.depth === 0 && n.name === name);
    const children: string[] = [];
    if (at < 0) return children;
    for (let i = at + 1; i < tree.length && tree[i].depth > 0; i++) children.push(tree[i].name);
    return children;
  }

  // Leaf texts of the job page (database rows, statistics, events).
  async jobPageTexts(): Promise<string[]> {
    return this.backup.visibleTexts();
  }

  async isEnabled(target: Locator): Promise<boolean> {
    return !(await this.backup.isDisabled(target));
  }
}

function xp(text: string): string {
  return text.includes("'") ? `concat('${text.replace(/'/g, "',\"'\",'")}')` : `'${text}'`;
}
