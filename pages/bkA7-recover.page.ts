import type { Locator, Page } from '@playwright/test';

// Recover wizard (Data Protection > job > Recover), Activities page and the repository Backups list, as far as the encryption
// recovery cases (ENC-04, ENC-07, ENC-08) need them. Own page file of assignment A7.
// UNVERIFIED: the Recover wizard was never opened during the owner-approved exploration; every locator here is text based and inferred from
// the cases and from knowledge/ui/screens/activities.md (Activities is Observed) and the memory note nakivo-db-backup-job-management
// (repository Backups list: Name, Encryption, Password, Job, Size; row ... -> Recover, Verify, Provide password, Delete).
// Page rules: locators and one-action methods only, no assertions, no .env, no waits.

export class BkA7RecoverPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // UNVERIFIED: the Recover button of a job page opens either the wizard directly or a small menu of recovery types.
  recoverButton(): Locator {
    return this.page.getByText('Recover', { exact: true }).filter({ visible: true }).first();
  }

  // UNVERIFIED: the menu entry for database recovery (text unknown): the first visible entry that mentions databases.
  databaseRecoveryMenuItem(): Locator {
    return this.page.getByText(/database/i).filter({ visible: true }).filter({ hasNotText: /Backup for Database/ }).last();
  }

  // UNVERIFIED: the recovery wizard header.
  wizardTitle(): Locator {
    return this.page.getByText(/Recovery Wizard|Recover .*Wizard|Recovery job/i).filter({ visible: true }).first();
  }

  nextButton(): Locator {
    return this.page.getByText('Next', { exact: true }).filter({ visible: true }).first();
  }

  finishButton(): Locator {
    return this.page.getByText(/^(Finish|Finish & Run|Recover|Run)$/).filter({ visible: true }).last();
  }

  cancelButton(): Locator {
    return this.page.getByText('Cancel', { exact: true }).filter({ visible: true }).last();
  }

  // UNVERIFIED: a password prompt (an input of type password, or a field labelled Password) shown when the stored password is missing.
  passwordPrompt(): Locator {
    return this.page.locator('.x-window:visible input[type="password"], input[type="password"]:visible').first();
  }

  // The first dialog line mentioning a missing or wrong password.
  passwordMessage(): Locator {
    return this.page.getByText(/password/i).filter({ visible: true }).filter({ hasNotText: /Set a password|Manage passwords|Select password|Create password/ }).first();
  }

  // ---- Activities (Observed in knowledge/ui/screens/activities.md): route /c/activities, Past Activities rows with a status badge ----

  static readonly activitiesRoute = '/c/activities';

  pastActivityRows(namePattern: RegExp): Locator {
    return this.page.locator('.x-grid-row:visible').filter({ hasText: namePattern });
  }

  // ---- Settings > Repositories > <repo> > Backups (UNVERIFIED navigation) ----

  static readonly settingsRoute = '/c/configuration';

  settingsTab(name: string): Locator {
    return this.page.getByText(name, { exact: true }).filter({ visible: true }).first();
  }

  repositoryEntry(name: string): Locator {
    return this.page.getByText(name, { exact: false }).filter({ visible: true }).first();
  }

  repositoryBackupRow(jobName: string): Locator {
    return this.page.locator('.x-grid-row:visible').filter({ hasText: jobName }).first();
  }
}
