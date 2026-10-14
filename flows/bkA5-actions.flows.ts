import type { Locator, Page } from '@playwright/test';
import { BkA5OptionsPage } from '../pages/bkA5-options.page';
import type { ScriptKind } from '../pages/bkA5-options.page';
import { BackupFlows } from './backup.flows';
import type { JobOutcome } from './backup.flows';

// Flows for the "Actions" (report e-mail, pre/post job script) and "Retention" cases. In 11.2.1 the Actions controls are on the Options step
// (step 4 of 4) and retention is the "Keep backups for" row of the Schedule step (step 3); there is no separate Actions or Retention step.
// Same rules as every flows file (standards/flows-layer.md): no assertions, no .env, no fixed sleeps.
// UNVERIFIED: see pages/bkA5-options.page.ts (recipient input, script popover fields, how a popover closes). The Edit "Save" path is not used here.

export interface ScriptSettings {
  /** Script path as the Director host sees it (the Director runs the script itself). */
  path: string;
  /** Error handling of the popover: 'Continue' keeps the job going when the script fails, 'Fail' fails the job. */
  onError?: 'Continue' | 'Fail';
}

export class BkA5ActionsFlows {
  readonly o: BkA5OptionsPage;
  readonly backup: BackupFlows;

  private readonly page: Page;

  constructor(page: Page, backup: BackupFlows) {
    this.page = page;
    this.backup = backup;
    this.o = new BkA5OptionsPage(page);
  }

  // Wizard up to the Schedule step (step 3): source, destination, Next.
  async startAtSchedule(item: string, db: string, repo: string): Promise<void> {
    await this.backup.openWizard();
    await this.backup.selectSources([{ item, databases: [db] }]);
    await this.backup.next();
    await this.backup.chooseDestination(repo);
    await this.backup.next();
    await this.o.keepBackupsLabel().waitFor({ timeout: 15_000 });
  }

  // Wizard up to the Options step (step 4): source, destination, run on demand, Next.
  async startAtOptions(item: string, db: string, repo: string): Promise<void> {
    await this.backup.openWizard();
    await this.backup.selectSources([{ item, databases: [db] }]);
    await this.backup.next();
    await this.backup.chooseDestination(repo);
    await this.backup.next();
    await this.backup.setOnDemand();
    await this.backup.next();
    await this.backup.wizard.jobNameField.waitFor({ timeout: 15_000 });
  }

  async isReportEnabled(): Promise<boolean> {
    return await this.isChecked(this.o.reportLabel());
  }

  // Ticks "Send job run reports to" when it is not ticked and types the recipient (replacing a pre-filled address).
  async setReportRecipient(email: string): Promise<void> {
    if (!(await this.isReportEnabled())) await this.o.reportLabel().click({ timeout: 10_000 });
    await this.typeInto(this.o.reportRecipients(), email);
  }

  async isScriptEnabled(kind: ScriptKind): Promise<boolean> {
    return await this.isChecked(this.o.scriptLabel(kind));
  }

  // Ticks "Run local pre/post job script", opens its settings popover and fills the path and the error handling.
  async configureScript(kind: ScriptKind, settings: ScriptSettings): Promise<void> {
    if (!(await this.isScriptEnabled(kind))) await this.o.scriptLabel(kind).click({ timeout: 10_000 });
    await this.o.scriptSettingsLink(kind).click({ timeout: 10_000 });
    await this.typeInto(this.o.scriptPathField(), settings.path);
    if (settings.onError) {
      await this.o.errorHandlingField().click({ timeout: 10_000 });
      await this.o.boundListMatching(settings.onError === 'Fail' ? /Fail/i : /Continue/i).click({ timeout: 10_000 });
    }
    // The popover closes when focus leaves it: click neutral label text.
    await this.o.jobNameLabel().click({ timeout: 10_000 });
  }

  // Job name, Finish & Run, Run in the dialog, then wait for the end of the run.
  async nameAndRun(jobName: string, timeoutMs = 300_000): Promise<JobOutcome> {
    await this.backup.setJobName(jobName);
    await this.backup.wizard.finishAndRunButton.click({ timeout: 10_000 });
    await this.backup.jobs.runDialog.waitFor({ timeout: 15_000 });
    await this.backup.jobs.runDialogRunButton.click({ timeout: 10_000 });
    try {
      await this.page.getByText(/Running \(/).filter({ visible: true }).first().waitFor({ timeout: 20_000 });
    } catch {
      // A run that ends within a second never shows "Running (".
    }
    return this.backup.waitForResult(timeoutMs);
  }

  // The leaf texts of the job page that match (events such as "The job has finished ..." or "... action has failed").
  async pageTextsMatching(pattern: RegExp): Promise<string[]> {
    return (await this.backup.visibleTexts()).filter((text) => pattern.test(text));
  }

  // Checked state of an Ext checkbox from its label (UNVERIFIED: class / aria markers of the Director's checkbox).
  async isChecked(label: Locator): Promise<boolean> {
    return label.evaluate((element) => {
      let node: HTMLElement | null = element as HTMLElement;
      for (let depth = 0; depth < 5 && node; depth++, node = node.parentElement) {
        if (/x-form-cb-checked|x-item-checked/.test(node.className)) return true;
        const inputs = Array.from(node.querySelectorAll('input')) as HTMLInputElement[];
        if (inputs.some((input) => input.getAttribute('aria-checked') === 'true' || (input.type === 'checkbox' && input.checked))) return true;
        if (inputs.length > 0 && depth >= 1) break;
      }
      return false;
    });
  }

  private async typeInto(field: Locator, value: string): Promise<void> {
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    await field.pressSequentially(value, { delay: 60 });
    await field.press('Tab');
  }
}
