import type { Locator, Page } from '@playwright/test';
import { BackupFlows } from './backup.flows';
import type { JobSource } from './backup.flows';
import type { WizardStep } from '../pages/backup-wizard.page';

// Flows for the wizard-behaviour cases of assignment A2 (General requirements, Create Job menu, Workflow steps 1 to 4): walk the 4-step
// "New Backup Job Wizard for Database" to a given step, read which step tabs and texts are on screen, leave through Cancel.
// Same rules as every flows file: no assertions, no .env, no fixed waits. Not yet run live; UNVERIFIED parts are marked in place.

export const WIZARD_STEPS: WizardStep[] = ['Source', 'Destination', 'Schedule', 'Options'];

export interface WizardWalk {
  item: string;
  databases: string[];
  repo: string;
}

export class WizardUiFlows {
  private readonly page: Page;

  constructor(page: Page, private readonly bk: BackupFlows) {
    this.page = page;
  }

  // UNVERIFIED: a "Back" button was not listed in the notes (buttons seen: Cancel, Next, Finish, Finish & Run, Save, Save & Run).
  get backButton(): Locator {
    return this.page.getByText('Back', { exact: true }).filter({ visible: true }).first();
  }

  async textVisible(text: string | RegExp, exact = true): Promise<boolean> {
    return (await this.page.getByText(text, { exact }).filter({ visible: true }).count()) > 0;
  }

  // Step names of the wizard that are on screen as tabs / headers.
  async visibleStepNames(): Promise<WizardStep[]> {
    const found: WizardStep[] = [];
    for (const step of WIZARD_STEPS) {
      if (await this.textVisible(step)) found.push(step);
    }
    return found;
  }

  // Opens the wizard and moves forward to `target` (Source: only opens and ticks; Destination: after Next; Schedule: destination chosen and
  // Next; Options: the default weekly schedule kept and Next).
  async walkTo(target: WizardStep, walk: WizardWalk): Promise<void> {
    await this.bk.openWizard();
    const source: JobSource = { item: walk.item, databases: walk.databases };
    await this.bk.selectSources([source]);
    if (target === 'Source') return;
    await this.bk.next();
    await this.bk.wizard.destinationCombo.waitFor({ timeout: 15_000 });
    if (target === 'Destination') return;
    await this.bk.chooseDestination(walk.repo);
    await this.bk.next();
    await this.bk.wizard.addScheduleLink.or(this.bk.wizard.onDemandCheckbox).first().waitFor({ timeout: 15_000 });
    if (target === 'Schedule') return;
    await this.bk.next();
    await this.bk.wizard.jobNameField.waitFor({ timeout: 15_000 });
  }

  async onSourceStep(): Promise<boolean> {
    return this.bk.wizard.selectionSummary.isVisible().catch(() => false);
  }

  async onDestinationStep(): Promise<boolean> {
    return this.bk.wizard.destinationCombo.isVisible().catch(() => false);
  }

  async onScheduleStep(): Promise<boolean> {
    return (await this.bk.wizard.onDemandCheckbox.isVisible().catch(() => false)) || (await this.bk.wizard.addScheduleLink.isVisible().catch(() => false));
  }

  async onOptionsStep(): Promise<boolean> {
    return this.bk.wizard.jobNameField.isVisible().catch(() => false);
  }

  // Cancel, and confirm a "Close the wizard?" question when the wizard asks one (the Inventory wizard does when it has changes).
  // UNVERIFIED for this wizard: the question and its Close button were not seen here.
  async cancelAndConfirm(): Promise<void> {
    await this.bk.cancelWizard();
    const dialog = this.page.locator('.x-window:visible').filter({ hasText: /Close the wizard\?|discard|unsaved/i }).last();
    try {
      await dialog.waitFor({ state: 'visible', timeout: 4_000 });
    } catch {
      return;
    }
    await dialog.getByText(/^(Close|Yes|Discard|OK)$/).last().click({ timeout: 10_000 });
  }

  async wizardIsOpen(): Promise<boolean> {
    return this.bk.wizard.title.isVisible().catch(() => false);
  }

  // Leaves an open wizard without a question left behind (for afterEach).
  async leaveWizardIfOpen(): Promise<void> {
    if (await this.wizardIsOpen()) await this.cancelAndConfirm();
  }

  // The text on the right panel of the Source step ("N item(s) were added to this job..." / "Select at least one item on the left").
  async sourceSummaryText(): Promise<string> {
    return ((await this.bk.wizard.selectionSummary.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
  }

  // Options step: ticks "Limit data backup to N concurrent streams" (the number is enabled only after it) and types the number.
  async setStreamLimit(value: string): Promise<void> {
    const field = this.bk.wizard.concurrentStreamsField();
    if (await this.bk.isDisabled(field)) await this.bk.wizard.optionCheckbox('Limit data backup to').click({ timeout: 10_000 });
    await this.typeInto(field, value);
  }

  // fill() does not reach Ext form values: type slowly, then Tab (aria-invalid is set on blur). Same recipe as BackupFlows.
  async typeInto(field: Locator, value: string): Promise<void> {
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    await field.pressSequentially(value, { delay: 80 });
    await field.press('Tab');
  }

  // Opens Data Protection > + and returns the "Backup for Database" entry without clicking it.
  async openCreateMenu(): Promise<Locator> {
    await this.bk.gotoJobs();
    await this.bk.jobs.addButton.click({ timeout: 10_000 });
    await this.bk.jobs.backupForDatabaseItem.waitFor({ timeout: 10_000 });
    return this.bk.jobs.backupForDatabaseItem;
  }

  async closeMenu(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }
}
