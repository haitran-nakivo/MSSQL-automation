import type { Locator, Page } from '@playwright/test';

// Backup Copy to Tape: the Backup Copy Job wizard, Settings/Configuration > Tape, the tape Recovery Job Wizard, Global Search.
// Own page file of assignment A7.
// UNVERIFIED: the Backup Copy wizard and the Tape tab were never opened during the owner-approved exploration (no tape hardware was available);
// every locator below is text based and inferred from the case texts ("Configuration > Tape > <library>", "Recover > Recover backup to repository",
// "Maximum number of drives", wizard steps Source / Destination / Schedule / Retention / Options from the Xray folder names).
// Page rules: locators and one-action methods only, no assertions, no .env, no waits.

export class BkA7TapePage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ---- Backup Copy Job wizard ----

  static readonly backupCopyMenuText = 'Backup Copy Job';

  backupCopyMenuItem(): Locator {
    return this.page.getByText(BkA7TapePage.backupCopyMenuText, { exact: true }).filter({ visible: true }).first();
  }

  wizardTitle(): Locator {
    return this.page.getByText(/Backup Copy Job Wizard|New Backup Copy Job/i).filter({ visible: true }).first();
  }

  maxDrivesInput(): Locator {
    return this.page.getByText('Maximum number of drives', { exact: false }).filter({ visible: true }).first().locator('xpath=following::input[1]');
  }

  // A visible text of an option or a mode ("Forever-incremental", "Incremental with active full").
  textOption(text: string | RegExp): Locator {
    return this.page.getByText(text).filter({ visible: true }).first();
  }

  // ---- Tape tab ----

  static readonly settingsRoute = '/c/configuration';

  tapeTab(): Locator {
    return this.page.getByText('Tape', { exact: true }).filter({ visible: true }).first();
  }

  tapeResource(name: string): Locator {
    return this.page.getByText(name, { exact: false }).filter({ visible: true }).first();
  }

  contentRows(): Locator {
    return this.page.locator('.x-grid-row:visible');
  }

  contentRow(text: string): Locator {
    return this.page.locator('.x-grid-row:visible').filter({ hasText: text }).first();
  }

  // ---- Recover menu and tape recovery wizard ----

  recoverButton(): Locator {
    return this.page.getByText('Recover', { exact: true }).filter({ visible: true }).first();
  }

  recoverToRepositoryItem(): Locator {
    return this.page.getByText('Recover backup to repository', { exact: false }).filter({ visible: true }).last();
  }

  recoveryWizardTitle(): Locator {
    return this.page.getByText(/Recovery Job Wizard|Recover from tape|tape recovery/i).filter({ visible: true }).first();
  }

  nextButton(): Locator {
    return this.page.getByText('Next', { exact: true }).filter({ visible: true }).first();
  }

  finishButton(): Locator {
    return this.page.getByText(/^(Finish|Finish & Run)$/).filter({ visible: true }).last();
  }

  cancelButton(): Locator {
    return this.page.getByText('Cancel', { exact: true }).filter({ visible: true }).last();
  }

  // A row of a wizard list (backup, repository) by its text.
  wizardRow(text: string): Locator {
    return this.page.locator('.x-grid-row:visible, .x-boundlist-item:visible, [class*="list-item"]:visible').filter({ hasText: text }).first();
  }

  // ---- Global Search ----

  globalSearchInput(): Locator {
    return this.page.locator('input[placeholder*="Search" i]:visible').first();
  }

  searchResult(text: string): Locator {
    return this.page.getByText(text, { exact: false }).filter({ visible: true }).first();
  }
}
