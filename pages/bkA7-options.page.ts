import type { Locator, Page } from '@playwright/test';

// Options step of the Backup for Database wizard (Data Transfer controls, job options) and the backup-encryption dialogs.
// Own page file of assignment A7; the shared pages/backup-wizard.page.ts is not changed.
// Facts: knowledge/workflows/backup/backup-job-wizard.md and the memory notes nakivo-db-backup-job-wizard / nakivo-db-backup-job-management
// (Observed 2026-10-07/08). Page rules: locators and one-action methods only, no assertions, no .env, no waits.
// UNVERIFIED: every locator marked so below was inferred from those notes, not seen live (the encryption dialogs were explored only partly).

export class BkA7OptionsPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ---- Options step ----

  // The label text of an option row ("Job priority", "Network acceleration", "Backup encryption", ...), exact text.
  optionLabel(text: string): Locator {
    return this.page.getByText(text, { exact: true }).filter({ visible: true }).first();
  }

  // The checkbox <label> of a checkbox option ("Limit data backup to", "Bottleneck detection", "Send job run reports to", ...).
  checkboxLabel(text: string): Locator {
    return this.page.locator('label:visible', { hasText: text }).first();
  }

  // UNVERIFIED: the info icon (i) sits after the row label; class names inferred, hover on the label is the fallback.
  infoIconAfter(label: Locator): Locator {
    return label.locator('xpath=following::*[contains(@class,"info") or contains(@class,"help") or contains(@class,"qtip") or contains(@class,"tooltip")][1]');
  }

  // The "settings" link that appears next to Backup encryption once it is Enabled (the pre/post script rows have their own "settings").
  encryptionSettingsLink(): Locator {
    return this.optionLabel('Backup encryption').locator('xpath=following::*[normalize-space(text())="settings"][1]');
  }

  // "Limit transporter load to:" is named by the cases; it was NOT seen on the 11.2.1 database Options step.
  transporterLoadCheckbox(): Locator {
    return this.page.locator('label:visible', { hasText: /Limit transporter load/i }).first();
  }

  // ---- "Set a password" dialog (UNVERIFIED locators except the texts quoted in the notes) ----

  setPasswordDialog(): Locator {
    return this.page.locator('.x-window:visible').filter({ hasText: 'Set a password' }).last();
  }

  selectPasswordRadio(): Locator {
    return this.setPasswordDialog().getByText('Select password', { exact: true }).first();
  }

  createPasswordRadio(): Locator {
    return this.setPasswordDialog().getByText('Create password', { exact: true }).first();
  }

  // The combo of "Select password" (first input after the radio label).
  selectPasswordCombo(): Locator {
    return this.selectPasswordRadio().locator('xpath=following::input[1]');
  }

  passwordField(): Locator {
    return this.setPasswordDialog().getByText(/^Password:?$/).first().locator('xpath=following::input[1]');
  }

  repeatPasswordField(): Locator {
    return this.setPasswordDialog().getByText(/^Repeat the password:?$/).first().locator('xpath=following::input[1]');
  }

  descriptionField(): Locator {
    return this.setPasswordDialog().getByText(/^Description:?$/).first().locator('xpath=following::*[self::input or self::textarea][1]');
  }

  // UNVERIFIED: the eye icon after a password field (class name inferred).
  eyeIconAfter(field: Locator): Locator {
    return field.locator('xpath=following::*[contains(@class,"eye") or contains(@class,"reveal") or contains(@class,"show-pass")][1]');
  }

  proceedButton(): Locator {
    return this.setPasswordDialog().getByText('Proceed', { exact: true }).last();
  }

  cancelButton(): Locator {
    return this.setPasswordDialog().getByText('Cancel', { exact: true }).last();
  }

  // UNVERIFIED: the window's x close tool (Ext JS: .x-tool-close).
  closeTool(): Locator {
    return this.setPasswordDialog().locator('.x-tool-close, [class*="tool-close"], [class*="close-btn"]').first();
  }

  manageLink(): Locator {
    return this.setPasswordDialog().getByText('Manage passwords', { exact: true }).first();
  }

  kmsWarning(): Locator {
    return this.setPasswordDialog().getByText(/The Key Management Service is disabled/);
  }

  encryptionTabLink(): Locator {
    return this.setPasswordDialog().getByText('Encryption Tab', { exact: true });
  }

  // ---- "Manage passwords" dialog (UNVERIFIED) ----

  managePasswordsDialog(): Locator {
    return this.page.locator('.x-window:visible').filter({ hasText: /Add Password/ }).last();
  }

  managePasswordRows(): Locator {
    return this.managePasswordsDialog().locator('.x-grid-row');
  }

  addPasswordButton(): Locator {
    return this.managePasswordsDialog().getByText('Add Password', { exact: false }).first();
  }

  manageCloseButton(): Locator {
    return this.managePasswordsDialog().getByText(/^(Close|Cancel)$/).last();
  }

  // The row-actions control of a password row ("..."); UNVERIFIED locator.
  passwordRowActions(row: Locator): Locator {
    return row.locator('xpath=.//*[normalize-space(text())="..." or contains(@class,"action") or contains(@class,"more")]').last();
  }

  deleteCredentialConfirm(): Locator {
    return this.page.locator('.x-window:visible').filter({ hasText: 'Delete the credential?' }).last();
  }

  // ---- Run dialog "Key Management Service is Disabled" warning (Observed on Finish & Run with encryption) ----

  runWarningDialog(): Locator {
    return this.page.locator('.x-window:visible').filter({ hasText: /Key Management Service is disabled/i }).last();
  }

  // ---- "Job options" popup on the job page (Observed: shows saved options) ----

  jobOptionsLink(): Locator {
    return this.page.getByText('Job options', { exact: true }).filter({ visible: true }).first();
  }
}
