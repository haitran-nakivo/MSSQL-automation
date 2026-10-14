import type { Locator, Page } from '@playwright/test';
import { viewingPause } from '../helpers/viewing-pause';
import { BackupJobPage } from '../pages/backup-job.page';
import { BackupWizardPage } from '../pages/backup-wizard.page';
import type { ScheduleType, SqlBackupType, WizardStep } from '../pages/backup-wizard.page';

// Business flows for the "Backup for Database" job: open the wizard, fill its steps, create / run / wait / delete a job, and read what the
// UI shows. Same rules as every flows file (standards/flows-layer.md): no assertions, no .env, no fixed waits; the specs assert and own
// the test data. Every wait is on an observable state with an explicit timeout.
//
// Facts used (Observed on Director 11.2.1.112232, 2026-10-07/08; knowledge/workflows/backup/backup-job-wizard.md): the wizard has
// 4 steps; Next needs at least one source; Destination has no default once two repositories exist; "Do not schedule, run on demand" hides
// the schedule section; "Finish & Run" opens "Run this job?"; a job page shows "Running (...)" and then "Last run was successful" or
// "Last run has failed"; the old status text stays on the page while a re-run is Running, so the end of a run is "no Running ( text".
// NOT re-verified in this session and NOT yet run: the first real run may need locator corrections in pages/backup-*.page.ts.

export interface JobSource {
  /** Display name of the Inventory item (instance, FCI, AG or Read-Scale AG), as shown in the source tree. */
  item: string;
  /** Databases to tick under the item. Omitted: the item itself is ticked, which includes all its databases and future ones. */
  databases?: string[];
}

export interface ScheduleOptions {
  type?: ScheduleType;
  /** SQL backup type of the schedule. The wizard default is Full. */
  sqlBackupType?: SqlBackupType;
  name?: string;
  /** "Keep backups for" count and unit (days by default). */
  keepFor?: { count: number; unit?: 'days' | 'weeks' | 'months' };
}

export interface JobOptions {
  priority?: 1 | 2 | 3 | 4 | 5;
  networkAcceleration?: boolean;
  networkEncryption?: boolean;
  /** Limit data backup to N concurrent streams (ticks the checkbox and sets the number). */
  concurrentStreams?: number;
  bottleneckDetection?: boolean;
}

export interface CreateJobRequest {
  name: string;
  sources: JobSource[];
  /** Name of the destination repository. Omitted: the wizard's own default is kept (only valid while one repository exists). */
  destination?: string;
  /** No schedule (or an empty list) means "Do not schedule, run on demand". */
  schedules?: ScheduleOptions[];
  options?: JobOptions;
  /** What to do on the last step. Default 'finish'. */
  finish?: 'finish' | 'finishAndRun' | 'stay';
}

export type JobOutcome = 'successful' | 'failed' | 'stopped' | 'warning' | 'timeout';

export interface RunRequest {
  /** Only offered by the dialog after the job has had a Full run (it then defaults to Log). */
  sqlBackupType?: SqlBackupType;
  scope?: 'all' | 'selected';
  /** Databases to keep ticked when scope is 'selected'. */
  databases?: string[];
}

const STATUS_END = /Last run (was|has)/;

export class BackupFlows {
  readonly wizard: BackupWizardPage;
  readonly jobs: BackupJobPage;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.wizard = new BackupWizardPage(page);
    this.jobs = new BackupJobPage(page);
  }

  // ---- open / navigate ----

  async gotoJobs(): Promise<void> {
    await this.jobs.goto();
    await this.jobs.addButton.waitFor({ timeout: 30_000 });
  }

  // Data Protection > + > Backup for Database: the wizard opens on Step 1 (Source).
  async openWizard(): Promise<void> {
    await this.gotoJobs();
    await this.jobs.addButton.click({ timeout: 10_000 });
    await this.jobs.backupForDatabaseItem.click({ timeout: 10_000 });
    await this.wizard.title.waitFor({ timeout: 30_000 });
  }

  // Clicks Next, then holds the new screen for the viewing pause. A negative case that expects Next to stay blocked passes
  // `{ blocked: true }`: nothing moved, so there is no new screen to hold and no pause.
  async next(options: { blocked?: boolean } = {}): Promise<void> {
    await this.wizard.nextButton.click({ timeout: 10_000 });
    if (!options.blocked) await viewingPause();
  }

  async goToStep(step: WizardStep): Promise<void> {
    await this.wizard.stepTab(step).click({ timeout: 10_000 });
  }

  async cancelWizard(): Promise<void> {
    await this.wizard.cancelButton.click({ timeout: 10_000 });
  }

  // ---- Step 1: Source ----

  // Ticks every source. An item with databases: only those databases; an item without: the item (all its databases).
  async selectSources(sources: JobSource[]): Promise<void> {
    for (const source of sources) {
      if (!source.databases || source.databases.length === 0) {
        await this.wizard.treeCheckbox(source.item).click({ timeout: 15_000 });
        continue;
      }
      for (const db of source.databases) {
        // A database name can occur under several items: take the match that sits after this item's row.
        await this.tickDatabaseUnder(source.item, db);
      }
    }
  }

  private async tickDatabaseUnder(item: string, db: string): Promise<void> {
    const box = this.page
      .locator(
        `xpath=//*[contains(@class,'x-grid-row') or contains(@class,'x-tree-node')][.//*[normalize-space(text())=${literal(db)}]][preceding::*[normalize-space(text())=${literal(item)}]]//*[contains(@class,'checkbox')]`,
      )
      .filter({ visible: true })
      .first();
    await box.click({ timeout: 15_000 });
  }

  async searchSources(text: string): Promise<void> {
    await this.wizard.sourceSearch.fill(text);
  }

  // ---- Step 2: Destination ----

  // Opens the combo and picks a repository by name; the list closes when focus leaves, so open and pick in one call.
  async chooseDestination(repoName: string): Promise<void> {
    await this.wizard.destinationCombo.click({ timeout: 10_000 });
    await this.wizard.destinationOption(repoName).click({ timeout: 10_000 });
  }

  async openAdvancedSetup(): Promise<void> {
    await this.wizard.advancedSetupLink.click({ timeout: 10_000 });
  }

  // ---- Step 3: Schedule ----

  async setOnDemand(): Promise<void> {
    await this.wizard.onDemandCheckbox.click({ timeout: 10_000 });
  }

  // Fills the first (or the n-th, index) schedule of the Schedule step. Unset options keep the wizard's defaults.
  async fillSchedule(schedule: ScheduleOptions, index = 0): Promise<void> {
    if (schedule.name !== undefined) await this.typeInto(this.wizard.scheduleField('scheduleName').nth(index), schedule.name);
    if (schedule.type) {
      await this.wizard.scheduleField('type').nth(index).click({ timeout: 10_000 });
      await this.wizard.boundListItem(schedule.type).click({ timeout: 10_000 });
    }
    if (schedule.keepFor) {
      await this.typeInto(this.wizard.scheduleField('customKeepSavepointCount').nth(index), String(schedule.keepFor.count));
      if (schedule.keepFor.unit) {
        await this.pickCombo(this.wizard.scheduleField('customKeepSavepointCount').nth(index).locator('xpath=following::input[1]'), schedule.keepFor.unit);
      }
    }
    if (schedule.sqlBackupType) await this.pickCombo(this.wizard.sqlBackupTypeField(), schedule.sqlBackupType);
  }

  async addAnotherSchedule(): Promise<void> {
    await this.wizard.addScheduleLink.click({ timeout: 10_000 });
  }

  // ---- Step 4: Options ----

  async setJobName(name: string): Promise<void> {
    await this.typeInto(this.wizard.jobNameField, name);
  }

  async fillOptions(options: JobOptions): Promise<void> {
    if (options.priority !== undefined) await this.pickCombo(this.wizard.optionInput('Job priority'), String(options.priority));
    if (options.networkAcceleration !== undefined) await this.pickCombo(this.wizard.optionInput('Network acceleration'), options.networkAcceleration ? 'Enabled' : 'Disabled');
    if (options.networkEncryption !== undefined) await this.pickCombo(this.wizard.optionInput('Network encryption'), options.networkEncryption ? 'Enabled' : 'Disabled');
    if (options.concurrentStreams !== undefined) {
      await this.wizard.optionCheckbox('Limit data backup to').click({ timeout: 10_000 });
      await this.typeInto(this.wizard.concurrentStreamsField(), String(options.concurrentStreams));
    }
    if (options.bottleneckDetection) await this.wizard.optionCheckbox('Bottleneck detection').click({ timeout: 10_000 });
  }

  // ---- create / run / wait / delete ----

  // The whole wizard in one call. Leaves the job saved (default), saved and running, or the wizard open on the last step.
  async createJob(request: CreateJobRequest): Promise<void> {
    await this.openWizard();
    await this.selectSources(request.sources);
    await this.next();
    if (request.destination) await this.chooseDestination(request.destination);
    await this.next();
    const schedules = request.schedules ?? [];
    if (schedules.length === 0) {
      await this.setOnDemand();
    } else {
      for (let i = 0; i < schedules.length; i++) {
        if (i > 0) await this.addAnotherSchedule();
        await this.fillSchedule(schedules[i], i);
      }
    }
    await this.next();
    await this.setJobName(request.name);
    if (request.options) await this.fillOptions(request.options);
    const finish = request.finish ?? 'finish';
    if (finish === 'finish') await this.wizard.finishButton.click({ timeout: 10_000 });
    if (finish === 'finishAndRun') {
      await this.wizard.finishAndRunButton.click({ timeout: 10_000 });
      await this.jobs.runDialog.waitFor({ timeout: 15_000 });
      await this.jobs.runDialogRunButton.click({ timeout: 10_000 });
    }
  }

  // Opens a job's page from the Jobs tree.
  async openJob(name: string): Promise<void> {
    await this.gotoJobs();
    await this.jobs.jobRow(name).click({ timeout: 15_000 });
    await this.jobs.statusLine.waitFor({ timeout: 30_000 });
  }

  // Whether a job with this exact name is listed. The Jobs tree fills a moment after the "+" shows (observed: a row added 0.16 s later), so
  // "not listed" is only answered once the job row has had its chance to appear (or the page says there are no jobs).
  async jobExists(name: string): Promise<boolean> {
    await this.gotoJobs();
    return this.jobIsListed(name);
  }

  private async jobIsListed(name: string): Promise<boolean> {
    const listed = this.jobs.jobRow(name).waitFor({ state: 'visible', timeout: 5_000 }).then(() => true);
    const empty = this.jobs.noJobs.waitFor({ state: 'visible', timeout: 5_000 }).then(() => false);
    try {
      return await Promise.any([listed, empty]);
    } catch {
      return false; // neither showed in time: the job is not listed
    }
  }

  // Runs the open job from its page through the Run dialog.
  async runOpenJob(request: RunRequest = {}): Promise<void> {
    await this.jobs.runButton.click({ timeout: 10_000 });
    await this.jobs.runDialog.waitFor({ timeout: 15_000 });
    if (request.sqlBackupType) await this.pickCombo(this.jobs.runDialogSqlBackupTypeField(), request.sqlBackupType);
    if (request.scope === 'selected') await this.jobs.runScopeOption('Run for selected databases').click({ timeout: 10_000 });
    await this.jobs.runDialogRunButton.click({ timeout: 10_000 });
    await this.waitForRunStarted();
  }

  // A re-run keeps the previous "Last run was ..." text on the page until the new run shows "Running (". Without this wait, waitForResult
  // right after a run could read that old text as the new result. Returns whether the run showed as started; a run that never shows
  // "Running (" within the time is left for waitForResult / the spec to judge.
  async waitForRunStarted(timeoutMs = 30_000): Promise<boolean> {
    try {
      await this.page.waitForFunction(() => /Running \(/.test(document.body.innerText), undefined, { timeout: timeoutMs, polling: 500 });
      return true;
    } catch (error) {
      if ((error as { name?: string } | null)?.name !== 'TimeoutError') throw error;
      return false;
    }
  }

  // Waits for the open job's current run to end and returns how it ended. A run is over when no "Running (" text is left and the status
  // line says "Last run was ..." / "Last run has ...". Runs take 20 to 70 s on the lab; the caller gives the timeout.
  async waitForResult(timeoutMs = 300_000): Promise<JobOutcome> {
    try {
      await this.page.waitForFunction(
        (endPattern) => {
          const text = document.body.innerText;
          return !/Running \(/.test(text) && new RegExp(endPattern).test(text);
        },
        STATUS_END.source,
        { timeout: timeoutMs, polling: 1_000 },
      );
    } catch (error) {
      // Only running out of time is the outcome 'timeout'; a closed page or a script error must not be reported as one.
      if ((error as { name?: string } | null)?.name !== 'TimeoutError') throw error;
      return 'timeout';
    }
    return this.readOutcome();
  }

  async readOutcome(): Promise<JobOutcome> {
    const text = (await this.jobs.statusLine.innerText()).toLowerCase();
    if (text.includes('stopped')) return 'stopped';
    if (text.includes('failed')) return 'failed';
    if (text.includes('warning')) return 'warning';
    if (text.includes('successful')) return 'successful';
    return 'timeout';
  }

  async readStatusLine(): Promise<string> {
    return (await this.jobs.statusLine.innerText()).replace(/\s+/g, ' ').trim();
  }

  // Deletes a job from its page (Manage > Delete). A job never run asks one question; a job with runs asks keep / delete the backups.
  async deleteOpenJob(keepBackups = true): Promise<void> {
    await this.jobs.manageButton.click({ timeout: 10_000 });
    await this.jobs.manageMenuItem('Delete').click({ timeout: 10_000 });
    const dialog = this.jobs.deleteDialog();
    await dialog.waitFor({ timeout: 15_000 });
    const scope = dialog.getByText(keepBackups ? 'Delete the job and keep the backups' : 'Delete the job and the backups', { exact: false });
    if ((await scope.count()) > 0) await scope.first().click({ timeout: 10_000 });
    await dialog.getByText('Delete', { exact: true }).last().click({ timeout: 10_000 });
    // Deleting the backups too asks once more ("Permanently delete the backups?"). That window opens after the click, so it is waited for;
    // an instant isVisible() would skip it and leave the job in place. (Keeping the backups is not known to ask it: not re-checked.)
    if (!keepBackups) await this.confirmPermanentDeleteIfAsked();
  }

  // Answers "Permanently delete the backups?" with Delete when the Director asks it; waits for the window to open, because it appears
  // after the click that caused it. Returns whether it was asked.
  async confirmPermanentDeleteIfAsked(timeoutMs = 5_000): Promise<boolean> {
    const confirm = this.page.locator('.x-window:visible').filter({ hasText: 'Permanently delete the backups?' }).last();
    const shown = await confirm.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => true, () => false);
    if (shown) await confirm.getByText('Delete', { exact: true }).last().click({ timeout: 10_000 });
    return shown;
  }

  // Best-effort cleanup for afterEach: removes a job the test created (keep its backups). True when the job is gone.
  async discardJobIfPresent(name: string, keepBackups = true): Promise<boolean> {
    if (!(await this.jobExists(name))) return true;
    await this.openJob(name);
    await this.deleteOpenJob(keepBackups);
    await this.gotoJobs();
    return !(await this.jobIsListed(name));
  }

  // ---- reading the UI (for the cases that check what is shown) ----

  // Leaf text of everything currently visible, in page order.
  async visibleTexts(): Promise<string[]> {
    return this.page.evaluate(() => {
      const found: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      for (let node = walker.nextNode() as HTMLElement | null; node; node = walker.nextNode() as HTMLElement | null) {
        if (node.children.length > 0 || node.offsetParent === null) continue;
        const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (text && !found.includes(text)) found.push(text);
      }
      return found;
    });
  }

  // Hover text of a control: the leaf texts that appear after a real hover (about 0.7 to 1.5 s). Returns the new texts, possibly none.
  async hoverTexts(target: Locator): Promise<string[]> {
    const before = await this.visibleTexts();
    await target.hover({ timeout: 10_000 });
    try {
      await this.page.waitForFunction(
        (known) => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
          for (let node = walker.nextNode() as HTMLElement | null; node; node = walker.nextNode() as HTMLElement | null) {
            if (node.children.length > 0 || node.offsetParent === null) continue;
            const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (text && !known.includes(text)) return true;
          }
          return false;
        },
        before,
        { timeout: 3_000, polling: 250 },
      );
    } catch {
      return [];
    }
    return (await this.visibleTexts()).filter((text) => !before.includes(text));
  }

  async isDisabled(target: Locator): Promise<boolean> {
    return target.evaluate((element) => {
      const el = element as HTMLInputElement;
      return el.disabled === true || el.getAttribute('aria-disabled') === 'true' || /x-item-disabled|x-disabled|x-btn-disabled/.test(el.className + ' ' + (el.closest('[class*=disabled]')?.className ?? ''));
    });
  }

  async fieldValue(target: Locator): Promise<string> {
    return target.inputValue();
  }

  async isInvalid(target: Locator): Promise<boolean> {
    return (await target.getAttribute('aria-invalid')) === 'true';
  }

  // ---- low level (Ext JS quirks: knowledge/ui/inventory/automation-notes.md) ----

  // fill() does not reach Ext form values: type slowly, then Tab (aria-invalid is set on blur).
  private async typeInto(field: Locator, value: string): Promise<void> {
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    await field.pressSequentially(value, { delay: 80 });
    await field.press('Tab');
  }

  // Combos: click the input, pick the exact text from the boundlist.
  private async pickCombo(input: Locator, text: string): Promise<void> {
    await input.click({ timeout: 10_000 });
    await this.wizard.boundListItem(text).click({ timeout: 10_000 });
  }
}

function literal(text: string): string {
  return text.includes("'") ? `concat('${text.replace(/'/g, "',\"'\",'")}')` : `'${text}'`;
}
