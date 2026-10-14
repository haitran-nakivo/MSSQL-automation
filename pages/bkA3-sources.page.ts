import type { Locator, Page } from '@playwright/test';

// Step 1 (Source) of "New Backup Job Wizard for Database": the Inventory tree on the left, the selected-items panel and the license label on
// the right. Extra locators for the Step 1 / UI cases (assignment A3), kept apart from pages/backup-wizard.page.ts, which other work shares.
//
// Observed (knowledge/workflows/backup/backup-job-wizard.md): a search box above a tree of Inventory items with their databases (no tempdb), a
// checkbox per row, the right panel text "N item(s) were added to this job..." / "Select at least one item on the left".
// UNVERIFIED (inferred from the Ext JS conventions in the notes, never seen live): the tree row classes (.x-grid-row / .x-tree-node), the
// expander (.x-tree-expander), the icon element, the license label wording and position, the "No matching items" text, the remove (X) control of
// the right panel. A first real run may need corrections here.
// Page object rules: locators and one-action methods; no assertions, no .env, no waits other than a locator's own.

export class BkA3SourcesPage {
  readonly searchField: Locator;
  readonly noMatchText: Locator;
  readonly selectionSummary: Locator;
  readonly dragHint: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.searchField = page.locator('input[placeholder*="Search" i]:visible').first();
    // UNVERIFIED: wording taken from the case ("No matching items"); the Director may say "No matching items found".
    this.noMatchText = page.getByText(/No matching items/i).filter({ visible: true }).first();
    this.selectionSummary = page.getByText(/item\(s\) were added to this job|Select at least one item on the left/).filter({ visible: true }).first();
    this.dragHint = page.getByText('Drag items to set processing priority', { exact: false }).filter({ visible: true }).first();
  }

  // Tree rows = visible grid rows / tree nodes that carry a checkbox. UNVERIFIED classes (see the header).
  treeRows(): Locator {
    return this.page
      .locator('.x-grid-row:visible, .x-tree-node:visible')
      .filter({ has: this.page.locator('[class*=checkbox]') });
  }

  // The n-th tree row whose text is exactly `name` (the same database name can sit under several items).
  rowByName(name: string, index = 0): Locator {
    return this.page
      .locator(
        `xpath=//*[contains(@class,'x-grid-row') or contains(@class,'x-tree-node')][.//*[normalize-space(text())=${xpathLiteral(name)}]][.//*[contains(@class,'checkbox')]]`,
      )
      .filter({ visible: true })
      .nth(index);
  }

  checkboxOf(name: string, index = 0): Locator {
    return this.rowByName(name, index).locator('[class*=checkbox]').first();
  }

  // UNVERIFIED: Ext tree expander (+ / -) of a container row.
  expanderOf(name: string, index = 0): Locator {
    return this.rowByName(name, index).locator('.x-tree-expander, [class*=expander], [class*=elbow-plus], [class*=elbow-minus]').first();
  }

  labelOf(name: string, index = 0): Locator {
    return this.rowByName(name, index).getByText(name, { exact: true }).first();
  }

  // An occurrence of `name` outside the tree rows = the entry in the right panel. UNVERIFIED structure of the panel.
  paneEntry(name: string): Locator {
    return this.page
      .locator(
        `xpath=//*[normalize-space(text())=${xpathLiteral(name)}][not(ancestor::*[contains(@class,'x-grid-row') or contains(@class,'x-tree-node')][.//*[contains(@class,'checkbox')]])]`,
      )
      .filter({ visible: true })
      .first();
  }

  // The remove (X) control of a right-panel entry: the first close / remove / delete / tool element in the entry's row. UNVERIFIED.
  paneRemoveControl(name: string): Locator {
    return this.paneEntry(name)
      .locator(
        'xpath=ancestor::*[.//*[contains(@class,"remove") or contains(@class,"close") or contains(@class,"delete") or contains(@class,"x-tool")]][1]',
      )
      .locator('[class*=remove], [class*=close], [class*=delete], .x-tool')
      .first();
  }

  paneEntryRow(name: string): Locator {
    return this.paneEntry(name).locator(
      'xpath=ancestor::*[.//*[contains(@class,"remove") or contains(@class,"close") or contains(@class,"delete") or contains(@class,"x-tool")]][1]',
    );
  }

  // The visible alert about too few licenses (wording from the case: "Not enough licenses to proceed. Contact Sales ...").
  licenseAlert(): Locator {
    return this.page.getByText(/Not enough licenses/i).filter({ visible: true }).first();
  }

  // Step 2 marker: the "Destination:" label.
  destinationLabel(): Locator {
    return this.page.getByText('Destination:', { exact: false }).filter({ visible: true }).first();
  }

  // Step headers of the wizard are clickable once reached (Edit wizard; the Add wizard after the step was visited).
  stepTab(step: 'Source' | 'Destination' | 'Schedule' | 'Options'): Locator {
    return this.page.getByText(step, { exact: true }).filter({ visible: true }).first();
  }

  // A confirmation window that may open when the wizard is cancelled (UNVERIFIED: not seen for the backup wizard).
  closeConfirmWindow(): Locator {
    return this.page.locator('.x-window:visible').filter({ hasText: /discard|unsaved|lose|Are you sure|Close/i }).last();
  }
}

function xpathLiteral(text: string): string {
  return text.includes("'") ? `concat('${text.replace(/'/g, "',\"'\",'")}')` : `'${text}'`;
}
