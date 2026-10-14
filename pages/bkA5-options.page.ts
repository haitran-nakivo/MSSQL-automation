import type { Locator, Page } from '@playwright/test';

// Step 4 (Options) controls that the Xray "Actions" and "Retention" cases look at: "Send job run reports to", "Run local pre/post job script"
// with their "settings" popovers, and the Schedule step's "Keep backups for" retention row.
// Facts (Observed 2026-10-08, memory nakivo-db-backup-job-wizard / nakivo-db-backup-job-management): "Send job run reports to" is a checkbox
// pre-ticked with the user's email; "Run local pre/post job script" are checkboxes whose "settings" link opens a popover: Script path,
// Timeout (Mins/Hrs), Job behavior (Wait / Do not wait), Error handling (Continue / Fail); "Keep backups for N [days|weeks|months]" has an info
// tooltip "The removal of the expired recovery points happens based on the system time."
// UNVERIFIED: the e-mail text input position (first text input after the checkbox label), the popover field labels used to find the inputs,
// the exact text of the "Fail" error-handling item, how a popover is closed, and the retention info-icon locator are inferred, not seen live.
// Page object rules: locators and one-action methods only; no assertions, no .env, no waits other than a locator's own.

export type ScriptKind = 'pre' | 'post';

export class BkA5OptionsPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  reportLabel(): Locator {
    return this.page.locator('label:visible', { hasText: 'Send job run reports to' }).first();
  }

  scriptLabel(kind: ScriptKind): Locator {
    return this.page.locator('label:visible', { hasText: kind === 'pre' ? 'Run local pre job script' : 'Run local post job script' }).first();
  }

  // The recipients text input that follows the "Send job run reports to" checkbox.
  reportRecipients(): Locator {
    return this.reportLabel().locator('xpath=following::input[@type="text"][1]');
  }

  // The "settings" link that follows a script checkbox.
  scriptSettingsLink(kind: ScriptKind): Locator {
    return this.scriptLabel(kind).locator('xpath=following::*[normalize-space(text())="settings"][1]');
  }

  // Popover fields (only the open popover is visible).
  scriptPathField(): Locator {
    return this.page.getByText('Script path', { exact: false }).filter({ visible: true }).first().locator('xpath=following::input[@type="text"][1]');
  }

  errorHandlingField(): Locator {
    return this.page.getByText('Error handling', { exact: false }).filter({ visible: true }).first().locator('xpath=following::input[@type="text"][1]');
  }

  boundListMatching(pattern: RegExp): Locator {
    return this.page.locator('.x-boundlist-item:visible').filter({ hasText: pattern }).first();
  }

  // Text of the labels that must not exist on the Options step.
  forbiddenCheckbox(pattern: string | RegExp): Locator {
    return this.page.getByText(pattern).filter({ visible: true });
  }

  jobNameLabel(): Locator {
    return this.page.getByText('Job name:', { exact: false }).filter({ visible: true }).first();
  }

  // Schedule step retention row.
  keepBackupsLabel(): Locator {
    return this.page.getByText('Keep backups for', { exact: false }).filter({ visible: true }).first();
  }

  keepBackupsCount(): Locator {
    return this.page.locator('input[name="customKeepSavepointCount"]:visible').first();
  }

  keepBackupsUnit(): Locator {
    return this.keepBackupsCount().locator('xpath=following::input[@type="text"][1]');
  }

  // The info icon next to "Keep backups for": the first element after the unit combo whose class mentions info or help.
  keepBackupsInfoIcon(): Locator {
    return this.keepBackupsUnit().locator('xpath=following::*[contains(@class,"info") or contains(@class,"help") or contains(@class,"tip")][1]');
  }
}
