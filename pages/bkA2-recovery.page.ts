import type { Locator, Page } from '@playwright/test';

// Two small page objects for the "Backup Scope: Chain / Workflow / General requirements" cases (assignment A2):
//  - BkA2RecoveryPage: the recovery wizard that the job page's Recover button opens (only its recovery-point picker is used).
//  - BkA2RepositoryPage: Settings > Repositories > <repository> and its list of backups.
// UNVERIFIED: every locator in this file is inferred from the notes (nakivo-db-backup-job-management: "Settings > Repositories > <repo> lists
// Backups (Name, Encryption, Password, Job, Size)"; nakivo-mssql-backup-types-spec: "Recover > Full recovery for individual database > picker Table
// view") and was not seen live. Text-based on purpose, so the first real run shows which one needs a correction.
// Rules: locators and one-action methods only; no assertions, no .env, no fixed waits.

export class BkA2RecoveryPage {
  readonly recoverOption: Locator;
  readonly pickerMarker: Locator;
  readonly nextButton: Locator;
  readonly cancelButton: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    // UNVERIFIED: the Recover menu entry for one database.
    this.recoverOption = page.getByText(/Full recovery for individual database/i).filter({ visible: true }).first();
    // UNVERIFIED: any text that proves the recovery-point picker is on screen.
    this.pickerMarker = page.getByText(/Recovery points?|Table view|Select a recovery point/i).filter({ visible: true }).first();
    this.nextButton = page.getByText('Next', { exact: true }).filter({ visible: true }).first();
    this.cancelButton = page.getByText('Cancel', { exact: true }).filter({ visible: true }).last();
  }

  // A row of the picker that shows the given backup type text (Full, Differential, Log). UNVERIFIED: the picker is assumed to be an Ext grid.
  pointRow(type: 'Full' | 'Differential' | 'Log'): Locator {
    return this.page.locator('.x-grid-row').filter({ visible: true }).filter({ hasText: new RegExp(type, 'i') }).first();
  }

  pointRows(): Locator {
    return this.page.locator('.x-grid-row').filter({ visible: true });
  }
}

export class BkA2RepositoryPage {
  private static readonly route = '/c/configuration';

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto(BkA2RepositoryPage.route);
    // UNVERIFIED: the Repositories tab is a text tab like Inventory (the Inventory tab is `.tabInventory`).
    await this.tab().click({ timeout: 15_000 });
  }

  tab(): Locator {
    return this.page.getByText('Repositories', { exact: true }).filter({ visible: true }).first();
  }

  repositoryRow(name: string): Locator {
    return this.page.getByText(name, { exact: true }).filter({ visible: true }).first();
  }

  // The row of a backup that belongs to a job, inside the open repository's Backups list.
  backupRowOfJob(jobName: string): Locator {
    return this.page.locator('.x-grid-row').filter({ visible: true }).filter({ hasText: jobName });
  }
}
