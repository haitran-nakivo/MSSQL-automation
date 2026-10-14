import type { Locator, Page } from '@playwright/test';

// Extra locators for the backup-type / backup-execution cases (assignment A1). Shared pages are not edited (pages/backup-*.page.ts).
// Facts: knowledge/workflows/backup/backup-job-wizard.md and the memory notes nakivo-db-backup-job-management (Edit wizard, Periodic
// schedule "Run every N [minutes|hours|days]", self-backup warning) and nakivo-mssql-backup-types-spec. Everything marked UNVERIFIED was
// inferred from those notes, never seen live. Page rules: locators only; no assertions, no .env, no waits.

export class BkA1ChainPage {
  // Job page: opens the Edit wizard ("Edit: <job>"). UNVERIFIED: the button text "Edit" is inferred from the notes.
  readonly editButton: Locator;
  // Edit wizard last step: "Save" and "Save & Run" exist on every step (notes), so the shared wizard.saveButton is used by flows.
  // Self-backup warning shown on Finish/Save when a schedule covers 02:00 (notes: "inferred trigger"). UNVERIFIED: text and buttons.
  readonly selfBackupDialog: Locator;
  // Recover wizard entry on the job page (shared jobs.recoverButton) and its first choice. UNVERIFIED: wording from the notes
  // ("Recover > Full recovery for individual database > picker Table view").
  readonly fullRecoveryChoice: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.editButton = page.getByText('Edit', { exact: true }).filter({ visible: true }).first();
    this.selfBackupDialog = page.locator('.x-window:visible').filter({ hasText: /self-backup|backup of the Director|Director backup/i }).last();
    this.fullRecoveryChoice = page.getByText('Full recovery for individual database', { exact: false }).filter({ visible: true }).first();
  }

  // Periodic schedule: "Run every [N] [unit]". UNVERIFIED: located by the label text "Run every"; the two inputs after it are the number
  // and the unit combo (notes: "Periodic = Run every N [minutes|hours|days] (min 1)").
  periodicEveryNumber(index = 0): Locator {
    return this.page.getByText('Run every', { exact: false }).filter({ visible: true }).nth(index).locator('xpath=following::input[1]');
  }

  periodicEveryUnit(index = 0): Locator {
    return this.page.getByText('Run every', { exact: false }).filter({ visible: true }).nth(index).locator('xpath=following::input[2]');
  }

  // The "SQL backup type" combo of the n-th schedule (the shared page only exposes the first one).
  sqlBackupTypeFieldAt(index: number): Locator {
    return this.page.getByText('SQL backup type', { exact: false }).filter({ visible: true }).nth(index).locator('xpath=following::input[1]');
  }

  // A button of the self-backup warning, by text. UNVERIFIED which of these the dialog has.
  selfBackupButton(text: string): Locator {
    return this.selfBackupDialog.getByText(text, { exact: true });
  }

  // Rows of the recovery point picker that mention a database. UNVERIFIED: the picker's DOM is not known; text based.
  recoveryPointRows(database: string): Locator {
    return this.page.locator('.x-grid-row:visible').filter({ hasText: database });
  }
}
