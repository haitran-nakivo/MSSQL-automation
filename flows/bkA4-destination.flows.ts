import type { Locator, Page } from '@playwright/test';
import type { BackupFlows, JobSource } from './backup.flows';

// Step 2 (Destination) of the "Backup for Database" wizard: Fast setup, the repository list, Advanced setup (item blocks, database rows).
// Same rules as every flows file (standards/flows-layer.md): no assertions, no .env, no fixed waits; the specs assert.
//
// Facts used (Observed on Director 11.2.1.112232, 2026-10-07/08; knowledge/workflows/backup/backup-job-wizard.md, memory note
// nakivo-db-backup-job-wizard): "Destination:" combo; no default once two repositories exist ("Select a target destination"); its list has a
// search box and the repositories; the banner "To re-use existing backups, expand the Advanced setup ..." and the "Advanced setup..." link;
// Advanced setup = per ticked item a collapsible block with "Default Destination" (tooltip text recorded in the note) and one row per database
// ("Click to expand"); a single ticked database shows its own "Destination" combo and "Use an existing backup as a target" when expanded;
// the Fast combo shows "Different backup repositories selected" when database destinations differ.
// UNVERIFIED (inferred from those notes, not seen live): the icon / indicator DOM, the exact markup of an item block header, the position of a
// row's "Destination" combo (taken as the first input after the row's name), the invalid-mark classes, and the "Default Destination" label text.

// Every Step-2 case starts "Jobs > Create > Microsoft SQL Server database backup job ... Step 1 - Databases"; the UI differs.
export const WIZARD_CASE_VS_UI =
  'The case says "Create > Microsoft SQL Server database backup job" and "Step 1 - Databases": the UI is Data Protection > + > Backup for Database, "New Backup Job Wizard for Database", Step 1 is named Source.';

export const ADVANCED_ROW_HINT = 'Click to expand';
export const EXISTING_BACKUP_CHECKBOX = 'Use an existing backup as a target';
export const DEFAULT_DESTINATION_TOOLTIP = 'The backup repository to which all new items (those that will be created in or moved to the source container) will be backed up.';

export class DestinationFlows {
  private readonly page: Page;
  private readonly backup: BackupFlows;

  constructor(page: Page, backup: BackupFlows) {
    this.page = page;
    this.backup = backup;
  }

  // ---- locators (kept here because pages/backup-wizard.page.ts is shared and read-only for this work) ----

  // The Fast setup combo: the first "Destination:" label on the step, the first input after it.
  get fastCombo(): Locator {
    return this.page.getByText(/^Destination:?$/).filter({ visible: true }).first().locator('xpath=following::input[1]');
  }

  // The mode-switch link itself (its text starts with "Advanced setup"); the banner sentence also contains the words, so match the whole text.
  get advancedLink(): Locator {
    return this.page.getByText(/^Advanced setup(\.{3}|…)?$/i).filter({ visible: true }).first();
  }

  // The search input inside the open destination list.
  get listSearch(): Locator {
    return this.page.locator('input[placeholder*="Search" i]:visible').first();
  }

  // "Default Destination" label of the n-th item block, and the combo after it.
  defaultDestinationLabel(index = 0): Locator {
    return this.page.getByText(/^Default Destination:?$/).filter({ visible: true }).nth(index);
  }

  defaultDestinationCombo(index = 0): Locator {
    return this.defaultDestinationLabel(index).locator('xpath=following::input[1]');
  }

  // The header of an item block or of a database row: the element whose whole text is the name.
  header(name: string): Locator {
    return this.page.getByText(name, { exact: true }).filter({ visible: true }).first();
  }

  // The destination combo of a database row (valid while the row is expanded): the first input after the row's name.
  rowCombo(name: string): Locator {
    return this.header(name).locator('xpath=following::input[1]');
  }

  text(text: string | RegExp, exact = false): Locator {
    return this.page.getByText(text, { exact }).filter({ visible: true });
  }

  // ---- navigation ----

  // Jobs > + > Backup for Database, tick the sources, Next: the wizard is on Step 2 in Fast setup.
  async openStep2(sources: JobSource[]): Promise<void> {
    await this.backup.openWizard();
    await this.backup.selectSources(sources);
    await this.backup.next();
    await this.fastCombo.waitFor({ state: 'visible', timeout: 30_000 });
  }

  // Step 1 only (to read the order of the selection before Next).
  async openStep1(sources: JobSource[]): Promise<void> {
    await this.backup.openWizard();
    await this.backup.selectSources(sources);
  }

  async nextToStep2(): Promise<void> {
    await this.backup.next();
    await this.fastCombo.waitFor({ state: 'visible', timeout: 30_000 });
  }

  async openAdvanced(): Promise<void> {
    await this.advancedLink.click({ timeout: 10_000 });
    await this.page.getByText(ADVANCED_ROW_HINT, { exact: false }).or(this.defaultDestinationLabel()).first().waitFor({ state: 'visible', timeout: 15_000 });
  }

  // Best effort for afterEach: leaves the wizard without saving anything (no job is ever created by the cases that use this file).
  async leaveWizard(): Promise<void> {
    try {
      if (await this.backup.wizard.cancelButton.first().isVisible()) await this.backup.wizard.cancelButton.first().click({ timeout: 5_000 });
    } catch {
      // The original failure is what the report shows.
    }
  }

  // ---- Fast setup ----

  async fastValue(): Promise<string> {
    return this.fastCombo.inputValue();
  }

  // True when the wizard pre-selected a repository (only while a single repository exists).
  async hasDefaultDestination(): Promise<boolean> {
    const value = (await this.fastValue()).trim();
    return value !== '' && !/Select a target destination/i.test(value);
  }

  async openList(): Promise<void> {
    await this.fastCombo.click({ timeout: 10_000 });
    await this.listSearch.waitFor({ state: 'visible', timeout: 10_000 });
  }

  async searchList(text: string): Promise<void> {
    await this.listSearch.click({ timeout: 10_000 });
    await this.listSearch.press('Control+A');
    await this.listSearch.pressSequentially(text, { delay: 80 });
  }

  async clearListSearch(): Promise<void> {
    await this.listSearch.click({ timeout: 10_000 });
    await this.listSearch.press('Control+A');
    await this.listSearch.press('Delete');
  }

  // Clicks a repository entry of the open list (the list is not a boundlist).
  async pickRepository(repo: string): Promise<void> {
    await this.backup.wizard.destinationOption(repo).click({ timeout: 10_000 });
  }

  // Number of visible entries that contain the text (repository names in the open list).
  async visibleCount(text: string): Promise<number> {
    return this.text(text).count();
  }

  // ---- Advanced setup: rows and blocks ----

  async expandedHintCount(): Promise<number> {
    return this.page.getByText(ADVANCED_ROW_HINT, { exact: false }).filter({ visible: true }).count();
  }

  // Click on a row / block header toggles it.
  async toggle(name: string): Promise<void> {
    await this.header(name).click({ timeout: 10_000 });
  }

  // Expands an item block when its "Default Destination" is not shown yet.
  async ensureBlockOpen(item: string): Promise<void> {
    if ((await this.defaultDestinationLabel().count()) > 0) return;
    await this.toggle(item);
    await this.defaultDestinationLabel().waitFor({ state: 'visible', timeout: 10_000 });
  }

  // Sets the destination of a collapsed database row: expand it, open its combo, pick the repository.
  async setRowDestination(db: string, repo: string): Promise<void> {
    await this.toggle(db);
    await this.rowCombo(db).waitFor({ state: 'visible', timeout: 10_000 });
    await this.rowCombo(db).click({ timeout: 10_000 });
    await this.pickRepository(repo);
  }

  async setDefaultDestination(repo: string, index = 0): Promise<void> {
    await this.defaultDestinationCombo(index).click({ timeout: 10_000 });
    await this.pickRepository(repo);
  }

  // ---- reading the UI ----

  // The given names ordered top to bottom as drawn. `pick` chooses which match counts when a name is drawn twice (Step 1: tree and right pane).
  async verticalOrder(names: string[], pick: 'first' | 'last' = 'first'): Promise<string[]> {
    const tops: { name: string; top: number }[] = [];
    for (const name of names) {
      const matches = this.page.getByText(name, { exact: true }).filter({ visible: true });
      const target = pick === 'first' ? matches.first() : matches.last();
      const box = await target.boundingBox();
      if (box) tops.push({ name, top: box.y });
    }
    return tops.sort((a, b) => a.top - b.top).map((entry) => entry.name);
  }

  // Descriptors of the icon-like elements (img, svg, i, span with an icon class) next to a header, to compare before / after a change.
  async iconSignature(name: string): Promise<string[]> {
    return this.header(name).evaluate((el) => {
      let scope: HTMLElement | null = el as HTMLElement;
      for (let depth = 0; depth < 4 && scope && scope.parentElement; depth++) {
        scope = scope.parentElement;
        if (scope.querySelectorAll('img, svg, i, [class*="icon" i], [class*="warn" i]').length > 0) break;
      }
      if (!scope) return [];
      return Array.from(scope.querySelectorAll('img, svg, i, [class*="icon" i], [class*="warn" i]'))
        .filter((node) => (node as HTMLElement).offsetParent !== null || node.tagName.toLowerCase() === 'svg')
        .map((node) => [node.tagName.toLowerCase(), (node as HTMLElement).className?.toString() ?? '', node.getAttribute('src') ?? '', node.getAttribute('title') ?? '', node.getAttribute('alt') ?? ''].join('|'));
    });
  }

  // True when an icon-like element sits before the name inside the same row.
  async hasLeadingIcon(name: string): Promise<boolean> {
    return this.header(name).evaluate((el) => {
      const row = (el.closest('[class*="row" i], [class*="item" i], [class*="node" i]') ?? el.parentElement) as HTMLElement | null;
      if (!row) return false;
      const icons = Array.from(row.querySelectorAll('img, svg, i, [class*="icon" i]'));
      return icons.some((icon) => icon !== el && !el.contains(icon) && (icon.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
    });
  }

  // Computed cursor of the element under the pointer after hovering a locator.
  async cursorOver(target: Locator): Promise<string> {
    await target.hover({ timeout: 10_000 });
    const box = await target.boundingBox();
    if (!box) return '';
    return this.page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? getComputedStyle(el).cursor : '';
      },
      [box.x + box.width / 2, box.y + box.height / 2],
    );
  }

  // Moves the pointer to a spot outside the wizard content (top-left corner of the page) and reports the cursor there.
  async cursorAway(): Promise<string> {
    await this.page.mouse.move(2, 2);
    return this.page.evaluate(() => {
      const el = document.elementFromPoint(2, 2);
      return el ? getComputedStyle(el).cursor : '';
    });
  }

  // Background colours of the element and its three ancestors, joined: changes when a hover highlight is applied.
  async backgroundSignature(target: Locator): Promise<string> {
    return target.evaluate((el) => {
      const parts: string[] = [];
      let node: HTMLElement | null = el as HTMLElement;
      for (let depth = 0; depth < 4 && node; depth++) {
        const style = getComputedStyle(node);
        parts.push(`${style.backgroundColor}/${style.boxShadow}/${style.outlineStyle}`);
        node = node.parentElement;
      }
      return parts.join(' | ');
    });
  }

  async moveAway(): Promise<void> {
    await this.page.mouse.move(2, 2);
  }

  // A required / invalid mark on a field: aria-invalid, an invalid-like class on it or its wrapper, or a red-ish border.
  async isMarkedInvalid(field: Locator): Promise<boolean> {
    return field.evaluate((el) => {
      const input = el as HTMLElement;
      if (input.getAttribute('aria-invalid') === 'true') return true;
      let node: HTMLElement | null = input;
      for (let depth = 0; depth < 4 && node; depth++) {
        if (/invalid|required|error/i.test(node.className?.toString() ?? '')) return true;
        const color = getComputedStyle(node).borderTopColor;
        const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
        if (match && Number(match[1]) > 170 && Number(match[2]) < 90 && Number(match[3]) < 90) return true;
        node = node.parentElement;
      }
      return false;
    });
  }

  // Tooltip text shown by hovering the "Default Destination" label (then, when none appears, its combo).
  async defaultDestinationTooltip(index = 0): Promise<string[]> {
    let texts = await this.backup.hoverTexts(this.defaultDestinationLabel(index));
    if (texts.length === 0) texts = await this.backup.hoverTexts(this.defaultDestinationCombo(index));
    return texts;
  }

  async onStep2(): Promise<boolean> {
    return this.fastCombo.isVisible();
  }

  // Step 3 shows the schedule section; used to prove Next did not advance.
  async scheduleStepShown(): Promise<boolean> {
    return (await this.text(/Do not schedule, run on demand/).count()) > 0;
  }
}
