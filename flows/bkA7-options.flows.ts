import type { Locator, Page } from '@playwright/test';
import { BackupFlows, type JobOptions, type JobOutcome } from './backup.flows';
import { BkA7OptionsPage } from '../pages/bkA7-options.page';
import type { A7Setup } from '../helpers/bkA7-env';

// Flows of assignment A7 for the Options / Data Transfer step of the Backup for Database wizard and for the backup-encryption dialogs.
// Built on BackupFlows (shared, unchanged). Same rules as every flows file: no assertions, no .env, no fixed waits; every wait is on an
// observable state with an explicit timeout. UNVERIFIED parts (see pages/bkA7-options.page.ts) are called out where they are used.

export type { JobOutcome, JobOptions };

export interface PasswordSpec {
  password: string;
  repeat?: string;
  description?: string;
}

export class BkA7OptionsFlows {
  readonly ui: BkA7OptionsPage;
  readonly backup: BackupFlows;
  readonly page: Page;

  constructor(page: Page, backup: BackupFlows) {
    this.page = page;
    this.backup = backup;
    this.ui = new BkA7OptionsPage(page);
  }

  // ---- reach the Options step ----

  // New wizard: one database of one item, destination repository, run on demand, then stop on the Options step (job name set when given).
  async openOptionsStep(setup: A7Setup, jobName?: string): Promise<void> {
    await this.backup.openWizard();
    await this.advanceToOptions(setup, jobName);
  }

  // The same from an already open wizard (Source, Destination, Schedule, Options).
  async advanceToOptions(setup: A7Setup, jobName?: string): Promise<void> {
    const b = this.backup;
    await b.selectSources([{ item: setup.item, databases: [setup.db] }]);
    await b.next();
    await b.chooseDestination(setup.repo);
    await b.next();
    await b.setOnDemand();
    await b.next();
    await b.wizard.jobNameField.waitFor({ timeout: 15_000 });
    if (jobName) await b.setJobName(jobName);
  }

  // Creates and saves a job (no run) with the given options.
  async createJob(setup: A7Setup, name: string, options?: JobOptions, finish: 'finish' | 'finishAndRun' | 'stay' = 'finish'): Promise<void> {
    await this.backup.createJob({ name, sources: [{ item: setup.item, databases: [setup.db] }], destination: setup.repo, options, finish });
  }

  // Edit wizard of a saved job, on its Options step (Manage > Edit, then the "Options" step tab).
  async openEditOptions(jobName: string): Promise<void> {
    await this.backup.openJob(jobName);
    await this.backup.jobs.manageButton.click({ timeout: 10_000 });
    await this.page.getByText('Edit', { exact: true }).filter({ visible: true }).last().click({ timeout: 10_000 });
    await this.backup.wizard.title.waitFor({ timeout: 30_000 });
    await this.backup.goToStep('Options');
    await this.backup.wizard.jobNameField.waitFor({ timeout: 15_000 });
  }

  // Leaves the open wizard without saving (Cancel). Best effort: a confirmation, if one appears, is not handled here.
  async leaveWizard(): Promise<void> {
    if (await this.backup.wizard.cancelButton.count()) await this.backup.wizard.cancelButton.first().click({ timeout: 10_000 });
  }

  // Saves the Edit wizard and waits for the wizard to close.
  async saveEdit(): Promise<void> {
    await this.backup.wizard.saveButton.click({ timeout: 10_000 });
    await this.backup.wizard.title.waitFor({ state: 'hidden', timeout: 30_000 });
  }

  // ---- reading and driving controls ----

  // State of an Ext checkbox row: the field container carries x-form-cb-checked (UNVERIFIED class; aria-checked / input.checked as fallbacks).
  async isChecked(label: Locator): Promise<boolean> {
    return label.evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement;
      for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
        if (/x-form-cb-checked/.test(node.className)) return true;
        const input = node.querySelector('input') as HTMLInputElement | null;
        if (input) {
          if (input.getAttribute('aria-checked') === 'true' || input.checked) return true;
          if (input.getAttribute('aria-checked') === 'false') return false;
        }
        if (/x-field\b/.test(node.className)) return false;
      }
      return false;
    });
  }

  async setChecked(label: Locator, wanted: boolean): Promise<void> {
    if ((await this.isChecked(label)) !== wanted) await label.click({ timeout: 10_000 });
  }

  async streamsValue(): Promise<string> {
    return this.backup.wizard.concurrentStreamsField().inputValue();
  }

  // Types into the streams field the way the Ext JS number field needs it (slow typing, then Tab so that validation runs).
  async typeStreams(value: string): Promise<void> {
    const field = this.backup.wizard.concurrentStreamsField();
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    if (value === '') {
      await field.press('Delete');
    } else {
      await field.pressSequentially(value, { delay: 80 });
    }
    await field.press('Tab');
  }

  async clearStreams(): Promise<void> {
    await this.typeStreams('');
  }

  // Current value of a combo option row ("Job priority", "Network acceleration", ...).
  async comboValue(label: string): Promise<string> {
    return this.backup.wizard.optionInput(label).inputValue();
  }

  async pickOption(label: string, text: string): Promise<void> {
    await this.backup.wizard.optionInput(label).click({ timeout: 10_000 });
    await this.backup.wizard.boundListItem(text).click({ timeout: 10_000 });
  }

  // The entries of a combo's list; the list is closed again with Escape.
  async comboChoices(label: string): Promise<string[]> {
    await this.backup.wizard.optionInput(label).click({ timeout: 10_000 });
    const items = this.page.locator('.x-boundlist-item:visible');
    await items.first().waitFor({ timeout: 10_000 });
    const texts = (await items.allInnerTexts()).map((t) => t.trim());
    await this.page.keyboard.press('Escape');
    return texts;
  }

  // Tooltip text of a control: hover the info icon first, then the label itself. Reads the Ext tooltip (.x-tip); returns '' when none shows.
  async tooltipOf(label: Locator): Promise<string> {
    for (const target of [this.ui.infoIconAfter(label), label]) {
      if ((await target.count()) === 0) continue;
      await target.first().hover({ timeout: 10_000 });
      const tip = this.page.locator('.x-tip:visible, [role="tooltip"]:visible').first();
      try {
        await tip.waitFor({ timeout: 3_000 });
        const text = (await tip.innerText()).replace(/\s+/g, ' ').trim();
        if (text) return text;
      } catch {
        // no tooltip on this target
      }
    }
    return '';
  }

  // Vertical position of a visible label (page coordinates), to compare the order of rows.
  async labelTop(label: Locator): Promise<number> {
    const box = await label.boundingBox();
    return box ? box.y : Number.NaN;
  }

  async fieldInvalid(field: Locator): Promise<boolean> {
    return (await field.getAttribute('aria-invalid')) === 'true';
  }

  // ---- encryption dialogs ----

  async enableBackupEncryption(): Promise<void> {
    await this.pickOption('Backup encryption', 'Enabled');
  }

  async openSetPassword(): Promise<void> {
    await this.ui.encryptionSettingsLink().click({ timeout: 10_000 });
    await this.ui.setPasswordDialog().waitFor({ timeout: 15_000 });
  }

  // Types into a dialog field (slow typing, then Tab so that validation runs on blur).
  async typeInto(field: Locator, value: string): Promise<void> {
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    if (value === '') {
      await field.press('Delete');
    } else {
      await field.pressSequentially(value, { delay: 40 });
    }
    await field.press('Tab');
  }

  async fillNewPassword(spec: PasswordSpec): Promise<void> {
    await this.typeInto(this.ui.passwordField(), spec.password);
    await this.typeInto(this.ui.repeatPasswordField(), spec.repeat ?? spec.password);
    if (spec.description !== undefined) await this.typeInto(this.ui.descriptionField(), spec.description);
  }

  // Create password and Proceed; true when the dialog closed.
  async createPassword(spec: PasswordSpec): Promise<boolean> {
    await this.fillNewPassword(spec);
    await this.ui.proceedButton().click({ timeout: 10_000 });
    return this.dialogClosed(this.ui.setPasswordDialog());
  }

  // Select password > pick the saved entry by its description; Proceed.
  async selectSavedPassword(description: string): Promise<boolean> {
    await this.ui.selectPasswordRadio().click({ timeout: 10_000 });
    await this.ui.selectPasswordCombo().click({ timeout: 10_000 });
    await this.backup.wizard.boundListItem(description).click({ timeout: 10_000 });
    await this.ui.proceedButton().click({ timeout: 10_000 });
    return this.dialogClosed(this.ui.setPasswordDialog());
  }

  async dialogClosed(dialog: Locator, timeoutMs = 5_000): Promise<boolean> {
    try {
      await dialog.waitFor({ state: 'hidden', timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  async dialogText(dialog: Locator): Promise<string> {
    return (await dialog.innerText()).replace(/\s+/g, ' ').trim();
  }

  async isDisabled(target: Locator): Promise<boolean> {
    return this.backup.isDisabled(target);
  }

  // Manage passwords: open from the Set a password dialog; list the descriptions (text of each row).
  async openManagePasswords(): Promise<void> {
    await this.ui.manageLink().click({ timeout: 10_000 });
    await this.ui.managePasswordsDialog().waitFor({ timeout: 15_000 });
  }

  async managePasswordRowTexts(): Promise<string[]> {
    const rows = this.ui.managePasswordRows();
    const texts = await rows.allInnerTexts();
    return texts.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  async closeManagePasswords(): Promise<void> {
    await this.ui.manageCloseButton().click({ timeout: 10_000 });
    await this.ui.managePasswordsDialog().waitFor({ state: 'hidden', timeout: 10_000 });
  }

  // Deletes every saved password whose row text contains `marker` (row ... > Delete > confirm). Dialog must be the open Manage passwords.
  async deletePasswordsContaining(marker: string): Promise<number> {
    let deleted = 0;
    for (let guard = 0; guard < 20; guard++) {
      const row = this.ui.managePasswordRows().filter({ hasText: marker }).first();
      if ((await row.count()) === 0) break;
      await row.hover({ timeout: 10_000 });
      await this.ui.passwordRowActions(row).click({ timeout: 10_000 });
      await this.page.getByText('Delete', { exact: true }).filter({ visible: true }).last().click({ timeout: 10_000 });
      const confirm = this.ui.deleteCredentialConfirm();
      await confirm.waitFor({ timeout: 10_000 });
      await confirm.getByText('Delete', { exact: true }).last().click({ timeout: 10_000 });
      await confirm.waitFor({ state: 'hidden', timeout: 10_000 });
      deleted++;
    }
    return deleted;
  }

  // Cleanup for the encryption specs: opens a throw-away wizard, enables encryption, opens Manage passwords, deletes the entries carrying the
  // marker (the case key is written in each description) and cancels the wizard without creating a job.
  async cleanupPasswords(setup: A7Setup, marker: string): Promise<number> {
    await this.openOptionsStep(setup);
    await this.enableBackupEncryption();
    await this.openSetPassword();
    await this.openManagePasswords();
    const deleted = await this.deletePasswordsContaining(marker);
    await this.closeManagePasswords();
    await this.ui.cancelButton().click({ timeout: 10_000 });
    await this.leaveWizard();
    return deleted;
  }

  // Edit wizard: Backup encryption = Enabled with a new password, then Save. True when the password dialog closed.
  async enableEncryptionOnJob(jobName: string, spec: PasswordSpec): Promise<boolean> {
    await this.openEditOptions(jobName);
    await this.enableBackupEncryption();
    await this.openSetPassword();
    const closed = await this.createPassword(spec);
    if (closed) await this.saveEdit();
    return closed;
  }

  // Edit wizard: Backup encryption = Disabled, then Save.
  async disableEncryptionOnJob(jobName: string): Promise<void> {
    await this.openEditOptions(jobName);
    await this.pickOption('Backup encryption', 'Disabled');
    await this.saveEdit();
  }

  // Edit wizard of an encrypted job: deletes the saved passwords whose row text contains `marker` through settings > Manage passwords, then leaves without saving.
  async deletePasswordsViaJob(jobName: string, marker: string): Promise<number> {
    await this.openEditOptions(jobName);
    await this.openSetPassword();
    await this.openManagePasswords();
    const deleted = await this.deletePasswordsContaining(marker);
    await this.closeManagePasswords();
    await this.ui.cancelButton().click({ timeout: 10_000 });
    await this.leaveWizard();
    return deleted;
  }

  // ---- running ----

  // Run from the open job page. The "SQL backup type" combo is offered only after a Full run exists (default Log) and not after a
  // destination or encryption change; pick `type` only when the combo is there.
  async runJob(type: 'Full' | 'Differential' | 'Log' = 'Full'): Promise<void> {
    const jobs = this.backup.jobs;
    await jobs.runButton.click({ timeout: 10_000 });
    await jobs.runDialog.waitFor({ timeout: 15_000 });
    if ((await jobs.runDialog.getByText('SQL backup type', { exact: false }).count()) > 0) {
      await jobs.runDialogSqlBackupTypeField().click({ timeout: 10_000 });
      await this.backup.wizard.boundListItem(type).click({ timeout: 10_000 });
    }
    await jobs.runDialogRunButton.click({ timeout: 10_000 });
  }

  // Finish & Run from the wizard: the "Run this job?" dialog and, for an encrypted job, the Key Management Service warning (Proceed). The order of the
  // two was not recorded, so the loop handles either first. Returns true when the warning appeared.
  async finishAndRun(): Promise<boolean> {
    await this.backup.wizard.finishAndRunButton.click({ timeout: 10_000 });
    const jobs = this.backup.jobs;
    const warning = this.ui.runWarningDialog();
    let warned = false;
    for (let i = 0; i < 4; i++) {
      await jobs.runDialog.or(warning).first().waitFor({ timeout: 15_000 });
      if (await warning.isVisible()) {
        await warning.getByText("Proceed", { exact: true }).last().click({ timeout: 10_000 });
        await warning.waitFor({ state: "hidden", timeout: 10_000 });
        warned = true;
        continue;
      }
      await jobs.runDialogRunButton.click({ timeout: 10_000 });
      await jobs.runDialog.waitFor({ state: "hidden", timeout: 15_000 });
      break;
    }
    if (!warned) warned = await this.confirmKmsWarning();
    return warned;
  }

  // The "Key Management Service is Disabled ... Don't show this again / Cancel / Proceed" warning shown when an encrypted job is run. True when it appeared.
  async confirmKmsWarning(): Promise<boolean> {
    const dialog = this.ui.runWarningDialog();
    try {
      await dialog.waitFor({ timeout: 5_000 });
    } catch {
      return false;
    }
    await dialog.getByText('Proceed', { exact: true }).last().click({ timeout: 10_000 });
    return true;
  }

  // Whether the Options step offers "Limit transporter load to:" (named by the cases, not seen on the 11.2.1 database Options step).
  async hasTransporterLoadControl(): Promise<boolean> {
    return (await this.ui.transporterLoadCheckbox().count()) > 0;
  }

  // UNVERIFIED: ticks "Limit transporter load to:" and types the value into the input that follows the label.
  async setTransporterLoad(value: string): Promise<void> {
    const label = this.ui.transporterLoadCheckbox();
    await this.setChecked(label, true);
    await this.typeInto(label.locator('xpath=following::input[1]'), value);
  }

  // Creates the job with the given Options values, runs it (Finish & Run) and waits for the end of the run.
  async createRunWait(setup: A7Setup, name: string, options?: JobOptions): Promise<JobOutcome> {
    await this.createJob(setup, name, options, 'finishAndRun');
    await this.confirmKmsWarning();
    await this.backup.jobs.statusLine.waitFor({ timeout: 60_000 });
    return this.backup.waitForResult(600_000);
  }

  // ---- reading the job page ----

  // Texts of the open page that match a pattern (events, statistics lines).
  async pageTextsMatching(pattern: RegExp): Promise<string[]> {
    return (await this.backup.visibleTexts()).filter((t) => pattern.test(t));
  }

  // "Job options" on the job page opens a popup with the saved options (Observed); returns its text and closes it with Escape.
  async readJobOptionsText(): Promise<string> {
    await this.ui.jobOptionsLink().click({ timeout: 10_000 });
    const popup = this.page.locator('.x-window:visible, .x-tip:visible, .x-panel-popup:visible').last();
    await popup.waitFor({ timeout: 10_000 });
    const text = (await popup.innerText()).replace(/\s+/g, ' ').trim();
    await this.page.keyboard.press('Escape');
    return text;
  }

  // Whether the Recover button of the job page is enabled (Observed: disabled until a run exists).
  async recoverEnabled(): Promise<boolean> {
    return !(await this.backup.isDisabled(this.backup.jobs.recoverButton));
  }
}
