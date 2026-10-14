import type { Locator, Page } from '@playwright/test';

// Step 2 (Destination) "Advanced setup" blocks of the Backup-for-Database wizard, plus the pop-ups that picking an existing backup opens.
// Facts (Observed 2026-10-08, memory nakivo-db-backup-job-wizard): "Advanced setup..." lists a collapsible block per ticked item with a
// "Default Destination" and one row per database ("Click to expand"); a database has its own "Destination" combo, the checkbox
// "Use an existing backup as a target" and a "Select a backup" combo (enabled only after a destination is chosen); the backup list is a
// grid/div popup that closes when focus leaves; picking a backup used by a live job opens "Cannot use the "<db>" backup" [OK], picking a free
// one opens "Use this backup as target?" [Proceed]; Edit + a changed destination asks "Change backup destination?".
// UNVERIFIED: every locator in this file is inferred from those notes and not seen live (no browser was opened while writing it): the DOM
// position of the per-database controls (found by document order from the database name), the toggle text of a row handle after expanding,
// the checked state of the Ext checkbox, and the class of the pop-up windows.
// Page object rules: locators and one-action methods only; no assertions, no .env, no waits other than a locator's own.

export const USE_EXISTING_TEXT = 'Use an existing backup as a target';
export const BACKUP_PLACEHOLDER = 'Select a backup';

export class BkA5DestinationPage {
  readonly topCombo: Locator;
  readonly expandHandles: Locator;
  readonly useExistingLabels: Locator;
  readonly blockedDialog: Locator;
  readonly confirmDialog: Locator;
  readonly changeDestinationDialog: Locator;
  readonly mixedDestinationsText: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.topCombo = page.getByText('Destination:', { exact: true }).filter({ visible: true }).first().locator('xpath=following::input[@type="text"][1]');
    this.expandHandles = page.getByText('Click to', { exact: false }).filter({ visible: true });
    this.useExistingLabels = page.getByText(USE_EXISTING_TEXT, { exact: true }).filter({ visible: true });
    this.blockedDialog = page.locator('.x-window:visible').filter({ hasText: 'Cannot use the' }).last();
    this.confirmDialog = page.locator('.x-window:visible').filter({ hasText: 'Use this backup as target?' }).last();
    this.changeDestinationDialog = page.locator('.x-window:visible').filter({ hasText: 'Change backup destination?' }).last();
    this.mixedDestinationsText = page.getByText('Different backup repositories selected', { exact: false }).filter({ visible: true }).first();
  }

  // The database name as shown on a destination row (the Source tree is not on this step).
  dbName(db: string): Locator {
    return this.page.getByText(db, { exact: true }).filter({ visible: true }).first();
  }

  // Visible "Click to ..." handles and "Use an existing backup" labels that follow the database name, in document order.
  private followingMarkers(db: string): Locator {
    return this.page
      .locator(
        `xpath=(//*[normalize-space(text())=${lit(db)}])[1]/following::*[contains(normalize-space(text()),'Click to') or normalize-space(text())='${USE_EXISTING_TEXT}']`,
      )
      .filter({ visible: true });
  }

  // The row handle of a database block (the "Click to expand" text that follows its name).
  handleFor(db: string): Locator {
    return this.dbName(db).locator('xpath=following::*[contains(normalize-space(text()),"Click to")][1]');
  }

  // The "Use an existing backup as a target" label that belongs to this database: the first marker after the name when the block is
  // open without a handle, or the second one when the handle comes first. A collapsed row never matches (its next marker is a handle).
  useExistingFor(db: string): Locator {
    const first = this.followingMarkers(db).nth(0).filter({ hasText: USE_EXISTING_TEXT });
    const second = this.followingMarkers(db).nth(1).filter({ hasText: USE_EXISTING_TEXT });
    return first.or(second);
  }

  // The database's own "Destination" combo: the first text input after its name.
  dbCombo(db: string): Locator {
    return this.dbName(db).locator('xpath=following::input[@type="text"][1]');
  }

  // The "Select a backup" combo: the first text input after the "Use an existing backup" label.
  backupCombo(db: string): Locator {
    return this.useExistingFor(db).locator('xpath=following::input[@type="text"][1]');
  }

  // An entry of the open backup list by (part of) its text; the popup is the last matching text in the document.
  backupEntry(text: string): Locator {
    return this.page.getByText(text, { exact: false }).filter({ visible: true }).last();
  }

  async clickBlockedOk(): Promise<void> {
    await this.blockedDialog.getByText('OK', { exact: true }).last().click({ timeout: 10_000 });
  }

  async clickProceed(): Promise<void> {
    await this.confirmDialog.getByText('Proceed', { exact: true }).last().click({ timeout: 10_000 });
  }

  async clickChange(): Promise<void> {
    await this.changeDestinationDialog.getByText('Change', { exact: true }).last().click({ timeout: 10_000 });
  }
}

function lit(text: string): string {
  return text.includes("'") ? `concat('${text.replace(/'/g, "',\"'\",'")}')` : `'${text}'`;
}
