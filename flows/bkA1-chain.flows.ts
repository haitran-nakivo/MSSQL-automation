import type { Locator, Page } from '@playwright/test';
import { BkA1ChainPage } from '../pages/bkA1-chain.page';
import type { BackupFlows } from './backup.flows';
import type { SqlBackupType } from '../pages/backup-wizard.page';

// Flows of the backup-type and backup-execution cases (assignment A1): run a job with a chosen SQL backup type, wait for "Running",
// add Periodic schedules to an existing job through the Edit wizard, clean a (possibly scheduled) job up, read the page text, try to
// list recovery points. Built on the shared BackupFlows (never edited). Rules (standards/flows-layer.md): no assertions, no .env, no
// fixed waits; every wait is on an observable state with an explicit timeout.
// UNVERIFIED parts (inferred from the notes, never seen live): the Edit button, the Periodic "Run every" inputs, the self-backup warning,
// the Recover picker. Each one is marked at its method.

export interface RunStart {
  /** True when the Run dialog offered the "SQL backup type" combo (only after the job has had a Full run). */
  typeChoiceShown: boolean;
  /** The combo's value after the choice, or '' when it was not shown. */
  typeValue: string;
}

export interface PeriodicSchedule {
  name: string;
  sqlBackupType: SqlBackupType;
  everyMinutes: number;
}

export class BkA1ChainFlows {
  readonly chain: BkA1ChainPage;

  private readonly page: Page;
  private readonly backup: BackupFlows;

  constructor(page: Page, backup: BackupFlows) {
    this.page = page;
    this.backup = backup;
    this.chain = new BkA1ChainPage(page);
  }

  // ---- running ----

  // Wizard last step: "Finish & Run", then Run in the "Run this job?" dialog (a never-run job offers no SQL backup type: the run is Full).
  async finishAndRun(): Promise<void> {
    await this.backup.wizard.finishAndRunButton.click({ timeout: 10_000 });
    await this.backup.jobs.runDialog.waitFor({ timeout: 15_000 });
    await this.backup.jobs.runDialogRunButton.click({ timeout: 10_000 });
  }

  // From the open job page: Run, choose the SQL backup type when the dialog offers it, confirm. The combo defaults to Log, so a caller
  // that wants Full or Differential must pass it.
  async startRun(type: SqlBackupType): Promise<RunStart> {
    const jobs = this.backup.jobs;
    await jobs.runButton.click({ timeout: 10_000 });
    await jobs.runDialog.waitFor({ timeout: 15_000 });
    const field = jobs.runDialogSqlBackupTypeField();
    const typeChoiceShown = (await field.count()) > 0;
    let typeValue = '';
    if (typeChoiceShown) {
      await field.click({ timeout: 10_000 });
      await this.backup.wizard.boundListItem(type).click({ timeout: 10_000 });
      typeValue = await field.inputValue();
    }
    await jobs.runDialogRunButton.click({ timeout: 10_000 });
    return { typeChoiceShown, typeValue };
  }

  // True when the job page shows "Running (" within the time (a run takes 20 to 70 s on the lab).
  async waitForRunning(timeoutMs = 20_000): Promise<boolean> {
    try {
      await this.page.waitForFunction(() => /Running \(/.test(document.body.innerText), undefined, { timeout: timeoutMs, polling: 250 });
      return true;
    } catch {
      return false;
    }
  }

  async isRunning(): Promise<boolean> {
    return (await this.page.getByText(/Running \(/).filter({ visible: true }).count()) > 0;
  }

  // ---- reading the job page ----

  // All visible text of the page, one line per leaf, for regex checks on events (job events, database rows, status line).
  async pageText(): Promise<string> {
    return (await this.backup.visibleTexts()).join('\n');
  }

  // ---- schedules (Edit wizard) ----

  // Opens the job, its Edit wizard and the Schedule step, unticks "Do not schedule, run on demand" when ticked, fills one Periodic schedule
  // per entry (every N minutes, SQL backup type) and saves. Returns true when the self-backup warning had to be confirmed.
  // UNVERIFIED: Edit button text; "Run every" inputs; the warning dialog (text and button).
  async addPeriodicSchedules(jobName: string, schedules: PeriodicSchedule[]): Promise<boolean> {
    await this.backup.openJob(jobName);
    await this.chain.editButton.click({ timeout: 10_000 });
    await this.backup.wizard.title.waitFor({ timeout: 30_000 });
    await this.backup.goToStep('Schedule');
    if (await this.isTicked(this.backup.wizard.onDemandCheckbox)) await this.backup.setOnDemand();
    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      if (i > 0) await this.backup.addAnotherSchedule();
      await this.backup.fillSchedule({ name: schedule.name, type: 'Periodic' }, i);
      await this.typeInto(this.chain.periodicEveryNumber(i), String(schedule.everyMinutes));
      await this.pickCombo(this.chain.periodicEveryUnit(i), 'minutes');
      await this.pickCombo(this.chain.sqlBackupTypeFieldAt(i), schedule.sqlBackupType);
    }
    await this.backup.wizard.saveButton.click({ timeout: 10_000 });
    return this.confirmSelfBackupWarning();
  }

  private async confirmSelfBackupWarning(): Promise<boolean> {
    try {
      await this.chain.selfBackupDialog.waitFor({ timeout: 5_000 });
    } catch {
      return false;
    }
    for (const text of ['Continue', 'OK', 'Yes', 'Save', 'Finish']) {
      const button = this.chain.selfBackupButton(text);
      if ((await button.count()) > 0) {
        await button.first().click({ timeout: 10_000 });
        return true;
      }
    }
    return false;
  }

  // ---- cleanup ----

  // Removes a job the case created, keeping its backups. A job with a Periodic schedule is disabled first (so it stops starting runs)
  // and a run in progress is waited out. Returns true when the job is gone. Best effort: the caller ignores a thrown error.
  async discardJobSafely(name: string, scheduled = false): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!(await this.backup.jobExists(name))) return true;
      await this.backup.openJob(name);
      if (scheduled) await this.disableOpenJob();
      if (await this.isRunning()) await this.backup.waitForResult(180_000);
      await this.backup.deleteOpenJob(true);
      await this.backup.gotoJobs();
      if ((await this.backup.jobs.jobRow(name).count()) === 0) return true;
    }
    return false;
  }

  private async disableOpenJob(): Promise<void> {
    await this.backup.jobs.manageButton.click({ timeout: 10_000 });
    const item = this.backup.jobs.manageMenuItem('Disable');
    if ((await item.count()) > 0) {
      await item.click({ timeout: 10_000 });
    } else {
      await this.page.keyboard.press('Escape');
    }
  }

  // ---- recovery points (UNVERIFIED) ----

  // Tries Recover > Full recovery for individual database and returns the picker rows that mention the database, or null when the picker
  // could not be reached. UNVERIFIED end to end: the Recover wizard was explored once (notes) and its locators are text-based guesses.
  // The caller uses the result only as evidence (an annotation); msdb history is the asserted source. Leaves the page on the Jobs view.
  async tryReadRecoveryPoints(jobName: string, database: string): Promise<string[] | null> {
    try {
      await this.backup.openJob(jobName);
      await this.backup.jobs.recoverButton.click({ timeout: 5_000 });
      await this.chain.fullRecoveryChoice.click({ timeout: 5_000 });
      const rows = this.chain.recoveryPointRows(database);
      await rows.first().waitFor({ timeout: 10_000 });
      return (await rows.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
    } catch {
      return null;
    } finally {
      try {
        await this.backup.gotoJobs();
      } catch {
        // leaving the wizard is best effort
      }
    }
  }

  // ---- low level (Ext JS: fill() does not reach form values, see knowledge/ui/inventory/automation-notes.md) ----

  private async typeInto(field: Locator, value: string): Promise<void> {
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    await field.pressSequentially(value, { delay: 80 });
    await field.press('Tab');
  }

  private async pickCombo(input: Locator, text: string): Promise<void> {
    await input.click({ timeout: 10_000 });
    await this.backup.wizard.boundListItem(text).click({ timeout: 10_000 });
  }

  // A checkbox label is ticked when its input (inside or next to it) is checked, or its Ext wrapper has a "checked" class.
  private async isTicked(label: Locator): Promise<boolean> {
    return label.evaluate((element) => {
      const root = element.closest('.x-form-item, .x-field') ?? element.parentElement ?? element;
      const input = root.querySelector('input[type=checkbox]') as HTMLInputElement | null;
      if (input) return input.checked;
      return /checked/.test(root.className);
    });
  }
}
