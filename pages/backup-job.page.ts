import type { Locator, Page } from '@playwright/test';

// Data Protection (route /c/main): the Jobs panel, a job's page, the Manage menu and the "Run this job?" dialog.
// Locator facts: owner-approved UI exploration on Director 11.2.1.112232, 2026-10-07/08 (knowledge/workflows/backup/backup-job-wizard.md).
// Not re-checked in this session; no case using this page has been run yet.
// Page object rules: locators and one-action methods only; no assertions, no .env, no fixed waits.

export class BackupJobPage {
  static readonly route = '/c/main';

  readonly addButton: Locator;
  readonly backupForDatabaseItem: Locator;
  readonly runButton: Locator;
  readonly stopButton: Locator;
  readonly recoverButton: Locator;
  readonly manageButton: Locator;
  readonly statusLine: Locator;
  readonly noJobs: Locator;
  // "Run this job?" dialog
  readonly runDialog: Locator;
  readonly runDialogRunButton: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    // The "+" of the Jobs panel header. Observed 2026-10-13 (11.2.1): the three `.add-btn` elements of this page are display:none
    // (zero size); the visible "+" is `.create-btn` inside `.header-nav-jobs`, and it opens the menu that lists "Backup for Database".
    this.addButton = page.locator('.header-nav-jobs .create-btn:visible').first();
    this.backupForDatabaseItem = page.getByText('Backup for Database', { exact: true }).filter({ visible: true }).first();
    this.runButton = page.getByText('Run', { exact: true }).filter({ visible: true }).first();
    this.stopButton = page.getByText('Stop', { exact: true }).filter({ visible: true }).first();
    this.recoverButton = page.getByText('Recover', { exact: true }).filter({ visible: true }).first();
    this.manageButton = page.getByText('Manage', { exact: true }).filter({ visible: true }).first();
    this.statusLine = page.getByText(/Last run (was|has)|This job has not been executed yet|Running \(/).filter({ visible: true }).first();
    this.noJobs = page.getByText('No available job.', { exact: true });
    this.runDialog = page.locator('.x-window:visible').filter({ hasText: 'Run this job?' }).last();
    this.runDialogRunButton = this.runDialog.getByText('Run', { exact: true }).last();
  }

  async goto(): Promise<void> {
    await this.page.goto(BackupJobPage.route);
  }

  // A job in the Jobs tree by its exact name.
  jobRow(name: string): Locator {
    return this.page.getByText(name, { exact: true }).filter({ visible: true }).first();
  }

  manageMenuItem(text: 'Clone' | 'Merge' | 'Rename' | 'Create Report' | 'Disable' | 'Enable' | 'Delete'): Locator {
    return this.page.getByText(text, { exact: true }).filter({ visible: true }).last();
  }

  // Run dialog: scope radios, the optional SQL backup type combo (shown once the job has a Full run), schedule / retention.
  runScopeOption(scope: 'Run for all databases' | 'Run for selected databases'): Locator {
    return this.runDialog.getByText(scope, { exact: true });
  }

  runDialogSqlBackupTypeField(): Locator {
    return this.runDialog.getByText('SQL backup type', { exact: false }).locator('xpath=following::input[1]');
  }

  deleteDialog(): Locator {
    return this.page.locator('.x-window:visible').filter({ hasText: /Delete this job\?|Are you sure you want to delete this job\?/ }).last();
  }

  // Events listed on the job page (text lines such as "The job has started", "Database processing has started").
  eventLine(text: string | RegExp): Locator {
    return this.page.getByText(text).filter({ visible: true }).first();
  }

  databaseRowStatus(db: string): Locator {
    return this.page
      .locator('.x-grid-row:visible')
      .filter({ hasText: db })
      .first();
  }
}
