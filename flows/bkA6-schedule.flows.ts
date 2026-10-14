import type { Locator, Page } from '@playwright/test';
import type { BackupFlows } from './backup.flows';
import { BkA6SchedulePage } from '../pages/bkA6-schedule.page';
import type { BackupHistoryRow, SqlBackupHost } from '../helpers/sql-host';

// Flows of the Step 3 (Schedule) cases (agent A6): reach the Schedule step, fill any number of schedules, finish (the self-backup warning is
// confirmed), read a schedule back through the job page and the Edit wizard, wait for AUTOMATIC runs, and clean up a job whose schedule keeps
// firing. Rules (standards/flows-layer.md): no assertions, no .env, no fixed waits; every wait is on an observable state with a timeout.
//
// Facts used (Observed on Director 11.2.1.112232; memory notes nakivo-db-backup-job-wizard / -job-management): the schedule is inline in Step 3
// of a 4-step wizard; Type = Weekly | Monthly | Yearly | Periodic | After another job; "Add another schedule" adds a block with a Remove link;
// Finish shows "Running a self-backup simultaneously with other jobs may cause issues with incremental backups." [Proceed / Cancel] when a
// schedule covers 02:00; the job page shows "Waiting on schedule" for a never-run scheduled job; a run is over when "Running (" is gone.
// Short automatic runs use a Periodic schedule "Run every 1 minute" (the minimum), never a wait for a Weekly / Monthly / Yearly slot.
// UNVERIFIED (inferred, not seen live): Periodic inputs, the "Effective from" picker cells, the Immutable control, Edit on the job page,
// the Settings > Repositories navigation. They are flagged at the locator (pages/bkA6-schedule.page.ts) or at the method.

export type A6ScheduleType = 'Weekly' | 'Monthly' | 'Yearly' | 'Periodic' | 'After another job';
export type A6SqlType = 'Full' | 'Differential' | 'Log';

export interface A6Schedule {
  name?: string;
  type?: A6ScheduleType;
  sqlBackupType?: A6SqlType;
  /** Periodic only: "Run every N minutes|hours|days". */
  periodic?: { every: number; unit: 'minutes' | 'hours' | 'days' };
  /** Click the "All days" link (so a short Periodic schedule also fires on a weekend). */
  allDays?: boolean;
  startAt?: string;
  endAt?: string;
  keepFor?: { count: number; unit?: 'days' | 'weeks' | 'months' };
  /** After another job: the parent job name. */
  parentJob?: string;
  /** "Effective from": the day of month and how many months ahead of the month the picker opens on. */
  effectiveFrom?: { day: number; monthsAhead: number };
  immutableDays?: number;
}

export interface A6JobRequest {
  name: string;
  item: string;
  db: string;
  repo: string;
  /** Empty: "Do not schedule, run on demand". */
  schedules: A6Schedule[];
  finish?: 'finish' | 'finishAndRun' | 'stay';
}

export interface A6ScheduleState {
  type: string;
  name: string;
  keepCount: string;
  keepUnit: string;
  sqlType: string;
}

export interface A6FieldBox {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  viewportWidth: number;
}

export interface A6RepoDeleteTry {
  /** The repository page and its backup row were reached and a Delete action was looked for. */
  reachedRow: boolean;
  /** The Delete menu item was present. */
  deleteOffered: boolean;
  /** The Delete menu item looked disabled. */
  deleteDisabled: boolean;
  /** Texts of the confirmation / refusal dialog, if one opened. */
  dialogTexts: string[];
  /** The backup row of the job is still listed after the attempt. */
  rowStillListed: boolean;
}

export class BkA6ScheduleFlows {
  readonly ui: BkA6SchedulePage;

  private readonly page: Page;
  private readonly backup: BackupFlows;

  constructor(page: Page, backup: BackupFlows) {
    this.page = page;
    this.backup = backup;
    this.ui = new BkA6SchedulePage(page);
  }

  // ---- reach Step 3 ----

  // Steps 1 and 2 of the wizard (one database, one repository) and Next to the Schedule step.
  async openScheduleStep(item: string, db: string, repo: string): Promise<void> {
    await this.backup.openWizard();
    await this.fromSourceToSchedule(item, db, repo);
  }

  // The wizard is open on Step 1: tick one database, Next, pick the repository, Next, wait for the Schedule step.
  async fromSourceToSchedule(item: string, db: string, repo: string): Promise<void> {
    await this.backup.selectSources([{ item, databases: [db] }]);
    await this.backup.next();
    await this.backup.chooseDestination(repo);
    await this.backup.next();
    await this.ui.onDemandCheckbox.waitFor({ timeout: 20_000 });
  }

  // ---- fill ----

  async fillSchedule(index: number, schedule: A6Schedule): Promise<void> {
    if (index > 0) {
      await this.ui.addScheduleLink.click({ timeout: 10_000 });
      await this.ui.header(index).waitFor({ timeout: 10_000 });
    }
    if (schedule.name !== undefined) await this.typeInto(this.ui.nameInput(index), schedule.name);
    if (schedule.type) await this.pickCombo(this.ui.typeInput(index), schedule.type);
    if (schedule.parentJob) await this.pickParentJob(index, schedule.parentJob);
    if (schedule.periodic) {
      await this.typeInto(this.ui.runEveryInput(index), String(schedule.periodic.every));
      await this.pickCombo(this.ui.runEveryUnitInput(index), schedule.periodic.unit);
    }
    if (schedule.allDays && (await this.ui.allDaysLink(index).count()) > 0) await this.ui.allDaysLink(index).click({ timeout: 10_000 });
    if (schedule.startAt !== undefined) await this.typeInto(this.ui.startAtInput(index), schedule.startAt);
    if (schedule.endAt !== undefined) {
      if (!(await this.isTicked(this.ui.endAtCheckbox(index)))) await this.ui.endAtCheckbox(index).click({ timeout: 10_000 });
      await this.typeInto(this.ui.endAtInput(index), schedule.endAt);
    }
    if (schedule.keepFor) {
      await this.typeInto(this.ui.keepCountInput(index), String(schedule.keepFor.count));
      if (schedule.keepFor.unit) await this.pickCombo(this.ui.keepUnitInput(index), schedule.keepFor.unit);
    }
    if (schedule.sqlBackupType) await this.pickCombo(this.ui.sqlTypeInput(index), schedule.sqlBackupType);
    if (schedule.effectiveFrom) await this.setEffectiveFrom(index, schedule.effectiveFrom.day, schedule.effectiveFrom.monthsAhead);
    if (schedule.immutableDays !== undefined) await this.setImmutable(index, schedule.immutableDays);
  }

  private async pickParentJob(index: number, parentName: string): Promise<void> {
    await this.ui.parentJobInput(index).click({ timeout: 10_000 });
    // The Parent job list is a grid/div popup that closes when focus leaves: open and pick in one call.
    await this.page.getByText(parentName, { exact: true }).filter({ visible: true }).last().click({ timeout: 10_000 });
  }

  // UNVERIFIED: the picker opens on the current month; cells are found by their day number.
  async setEffectiveFrom(index: number, day: number, monthsAhead: number): Promise<void> {
    await this.ui.effectiveFromLink(index).click({ timeout: 10_000 });
    await this.ui.datePicker.waitFor({ timeout: 10_000 });
    for (let n = 0; n < monthsAhead; n++) {
      await this.ui.datePicker.locator('[class*="next"]').first().click({ timeout: 10_000 });
    }
    await this.ui.datePicker.getByText(String(day), { exact: true }).first().click({ timeout: 10_000 });
    await this.ui.datePicker.getByText('Apply', { exact: true }).first().click({ timeout: 10_000 });
  }

  // UNVERIFIED: ticks the immutability checkbox when there is one, then types the period into the field after the label.
  async setImmutable(index: number, days: number): Promise<void> {
    await this.ui.immutableLabel(index).waitFor({ timeout: 10_000 });
    if ((await this.ui.immutableCheckbox(index).count()) > 0 && !(await this.isTicked(this.ui.immutableCheckbox(index)))) {
      await this.ui.immutableCheckbox(index).click({ timeout: 10_000 });
    }
    await this.typeInto(this.ui.immutableDaysInput(index), String(days));
  }

  async hasImmutableControl(index: number): Promise<boolean> {
    return this.ui.immutableLabel(index).waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false,
    );
  }

  // ---- create / finish ----

  async createJob(request: A6JobRequest): Promise<void> {
    await this.openScheduleStep(request.item, request.db, request.repo);
    if (request.schedules.length === 0) {
      await this.backup.setOnDemand();
    } else {
      for (let i = 0; i < request.schedules.length; i++) await this.fillSchedule(i, request.schedules[i]);
    }
    await this.backup.next();
    await this.backup.setJobName(request.name);
    await this.finish(request.finish ?? 'finish');
  }

  // Finish / Finish & Run on the last step. The self-backup warning (any schedule covering 02:00) is confirmed with Proceed.
  async finish(mode: 'finish' | 'finishAndRun' | 'stay'): Promise<void> {
    if (mode === 'stay') return;
    const jobs = this.backup.jobs;
    if (mode === 'finish') {
      await this.backup.wizard.finishButton.click({ timeout: 10_000 });
      await this.confirmWarnings(jobs.statusLine, 60_000);
      return;
    }
    await this.backup.wizard.finishAndRunButton.click({ timeout: 10_000 });
    await this.confirmWarnings(jobs.runDialog, 60_000);
    await jobs.runDialogRunButton.click({ timeout: 10_000 });
    await jobs.statusLine.waitFor({ timeout: 60_000 });
  }

  private async confirmWarnings(done: Locator, timeoutMs: number): Promise<void> {
    for (let n = 0; n < 3; n++) {
      await done.or(this.ui.selfBackupWarning).first().waitFor({ timeout: timeoutMs });
      if (await this.ui.selfBackupWarning.isVisible().catch(() => false)) {
        await this.ui.selfBackupProceed.click({ timeout: 10_000 });
        continue;
      }
      return;
    }
  }

  // ---- read a saved job back ----

  // From the Jobs tree: Edit, then the Schedule step tab.
  async openEditSchedule(jobName: string): Promise<void> {
    await this.backup.openJob(jobName);
    await this.ui.editButton().click({ timeout: 10_000 });
    await this.backup.wizard.title.waitFor({ timeout: 30_000 });
    await this.backup.goToStep('Schedule');
    await this.ui.header(0).waitFor({ timeout: 20_000 });
  }

  // Save on the open Edit wizard (any step); the self-backup warning is confirmed; ends on the job page.
  async saveEdit(): Promise<void> {
    await this.backup.wizard.saveButton.click({ timeout: 10_000 });
    await this.confirmWarnings(this.backup.jobs.statusLine, 60_000);
  }

  // Leaves the Edit wizard without saving (Cancel, and Close when the wizard asks).
  async closeEditor(): Promise<void> {
    await this.backup.cancelWizard();
    const asked = await this.ui.closePrompt.waitFor({ timeout: 3_000 }).then(
      () => true,
      () => false,
    );
    if (asked) await this.ui.closePromptButton.click({ timeout: 10_000 });
  }

  async scheduleCount(): Promise<number> {
    return this.page.locator('input[name="type"]:visible').count();
  }

  async readSchedule(index: number): Promise<A6ScheduleState> {
    const read = async (field: Locator): Promise<string> => ((await field.count()) > 0 ? field.inputValue() : '');
    return {
      type: await read(this.ui.typeInput(index)),
      name: await read(this.ui.nameInput(index)),
      keepCount: await read(this.ui.keepCountInput(index)),
      keepUnit: await read(this.ui.keepUnitInput(index)),
      sqlType: await read(this.ui.sqlTypeInput(index)),
    };
  }

  // Job page text lines about the schedule (summary sentence, status, "Schedule: ...").
  async scheduleLines(): Promise<string[]> {
    const texts = await this.backup.visibleTexts();
    return texts.filter((text) => /Runs |Run every|Starting at|Waiting on schedule|Schedule:|Manual run|After /i.test(text));
  }

  async eventLines(pattern: RegExp): Promise<string[]> {
    const texts = await this.backup.visibleTexts();
    return texts.filter((text) => pattern.test(text));
  }

  // ---- tooltips, option lists, layout ----

  async hoverTexts(target: Locator): Promise<string[]> {
    return this.backup.hoverTexts(target);
  }

  // Opens a combo, reads its options, and closes it again by picking `keep` (so the value is not changed).
  async comboOptions(input: Locator, keep: string): Promise<string[]> {
    await input.click({ timeout: 10_000 });
    await this.ui.boundItems().first().waitFor({ timeout: 10_000 });
    const options = (await this.ui.boundItems().allInnerTexts()).map((text) => text.trim());
    await this.ui.boundItem(keep).click({ timeout: 10_000 });
    return options;
  }

  async isEditable(input: Locator): Promise<boolean> {
    return input.isEditable();
  }

  async clearByKeyboard(input: Locator): Promise<void> {
    await input.click({ timeout: 10_000 });
    await input.press('Control+A');
    await input.press('Delete');
    await input.press('Tab');
  }

  async fieldBoxes(): Promise<A6FieldBox[]> {
    return this.page.evaluate(() =>
      Array.from(document.querySelectorAll('input[name]'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return { name: (el as HTMLInputElement).name, x: r.x, y: r.y, w: r.width, h: r.height, viewportWidth: window.innerWidth };
        })
        .filter((box) => box.w > 0 && box.h > 0),
    );
  }

  async isTicked(label: Locator): Promise<boolean> {
    return label.evaluate((element) => {
      const field = element.closest('.x-field') ?? element.parentElement ?? element;
      const box = field.querySelector('[role="checkbox"], input[type="checkbox"]') as HTMLInputElement | null;
      if (box) {
        const aria = box.getAttribute('aria-checked');
        if (aria !== null) return aria === 'true';
        if (typeof box.checked === 'boolean') return box.checked;
      }
      return /x-form-cb-checked|checked/.test(field.className);
    });
  }

  // ---- waits on automatic runs ----

  // Waits (on the open job's page) until a run is shown as "Running (". A scheduled run starts by itself: the page is reloaded now and then
  // in case it does not refresh. Returns false when no run started within the timeout.
  // anyRun: also accept "Last run was / has ..." (a job that has already finished its first run before the page was looked at).
  async waitRunStart(timeoutMs: number, anyRun = false): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const pattern = anyRun ? 'Running \\(|Last run (was|has)' : 'Running \\(';
    while (Date.now() < deadline) {
      const seen = await this.page
        .waitForFunction((source) => new RegExp(source).test(document.body.innerText), pattern, { timeout: 20_000, polling: 1_000 })
        .then(
          () => true,
          () => false,
        );
      if (seen) return true;
      await this.page.reload();
      await this.backup.jobs.statusLine.waitFor({ timeout: 30_000 }).catch(() => undefined);
    }
    return false;
  }

  // True when no run starts within the window (used to show a job does NOT run, for example before its Effective-from date).
  async stayedIdle(windowMs: number): Promise<boolean> {
    return !(await this.waitRunStart(windowMs));
  }

  // Waits until no "Running (" text is left on the open job's page.
  async waitIdle(timeoutMs: number): Promise<boolean> {
    return this.page
      .waitForFunction(() => !/Running \(/.test(document.body.innerText), undefined, { timeout: timeoutMs, polling: 1_000 })
      .then(
        () => true,
        () => false,
      );
  }

  // ---- msdb evidence (the recovery point type) ----

  // Rows of NAKIVO (virtual device, device_type 7) backups that were not in `before` (matched by finish time), oldest first.
  async newNbrBackups(host: SqlBackupHost, db: string, before: BackupHistoryRow[]): Promise<BackupHistoryRow[]> {
    const known = new Set(before.map((row) => row.finishedAt));
    const after = await host.backupHistory(db, 50);
    return after.filter((row) => row.deviceType === '7' && !known.has(row.finishedAt)).reverse();
  }

  // ---- cleanup ----

  // Best-effort cleanup of a job whose schedule may keep firing: disable it, let a running run end, delete it keeping the backups.
  async retireJob(name: string): Promise<boolean> {
    if (!(await this.backup.jobExists(name))) return true;
    await this.backup.openJob(name);
    await this.disableIfEnabled();
    await this.waitIdle(240_000);
    await this.backup.deleteOpenJob(true);
    return !(await this.backup.jobExists(name)); // jobExists opens the Jobs page and waits for the list
  }

  async disableIfEnabled(): Promise<boolean> {
    const jobs = this.backup.jobs;
    await jobs.manageButton.click({ timeout: 10_000 });
    const disable = jobs.manageMenuItem('Disable');
    // The menu opens after the click: wait until it shows Disable or Enable, so "not Disable" really means the job is already disabled.
    await disable.or(jobs.manageMenuItem('Enable')).first().waitFor({ state: 'visible', timeout: 10_000 });
    if (await disable.isVisible()) {
      await disable.click({ timeout: 10_000 });
      return true;
    }
    await this.page.keyboard.press('Escape');
    return false;
  }

  // ---- Settings > Repositories (UNVERIFIED navigation, used by the immutable cases) ----

  async openRepository(repo: string): Promise<void> {
    await this.page.goto('/c/configuration');
    await this.ui.repositoriesTab().click({ timeout: 20_000 });
    await this.ui.repositoryRow(repo).click({ timeout: 20_000 });
  }

  async repositoryBackupTexts(jobName: string): Promise<string[]> {
    const row = this.ui.backupRow(jobName);
    if ((await row.count()) === 0) return [];
    return (await row.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
  }

  // Tries to delete the backup of a job from the repository page (row "..." > Delete) and reports what the UI did. It confirms a
  // confirmation prompt, so a repository that allows the delete really loses that backup: only the backup of the test's own job is targeted.
  async tryDeleteRepositoryBackup(repo: string, jobName: string): Promise<A6RepoDeleteTry> {
    const result: A6RepoDeleteTry = { reachedRow: false, deleteOffered: false, deleteDisabled: false, dialogTexts: [], rowStillListed: false };
    await this.openRepository(repo);
    const row = this.ui.backupRow(jobName);
    if ((await row.count()) === 0) return result;
    result.reachedRow = true;
    await row.hover({ timeout: 10_000 });
    await row.locator('.more-horizontal-btn').first().click({ timeout: 10_000 });
    const item = this.page.getByText('Delete', { exact: true }).filter({ visible: true }).last();
    // The row menu opens after the click: "Delete is not offered" is only concluded once the menu has had time to show it.
    result.deleteOffered = await item.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true, () => false);
    if (!result.deleteOffered) return result;
    result.deleteDisabled = await this.backup.isDisabled(item);
    if (result.deleteDisabled) return result;
    await item.click({ timeout: 10_000 });
    const dialog = this.page.locator('.x-window:visible').last();
    await dialog.waitFor({ timeout: 15_000 }).catch(() => undefined);
    result.dialogTexts = (await dialog.innerText().catch(() => '')).split('\n').map((line) => line.trim()).filter(Boolean);
    const confirm = dialog.getByText('Delete', { exact: true }).last();
    if ((await confirm.count()) > 0) await confirm.click({ timeout: 10_000 });
    await this.backup.confirmPermanentDeleteIfAsked();
    await this.page.locator('.x-window:visible').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
    result.rowStillListed = (await this.ui.backupRow(jobName).count()) > 0;
    return result;
  }

  // ---- low level (Ext JS quirks: type slowly, then Tab; combos: click the input, pick from the list) ----

  private async typeInto(field: Locator, value: string): Promise<void> {
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    await field.pressSequentially(value, { delay: 80 });
    await field.press('Tab');
  }

  private async pickCombo(input: Locator, text: string): Promise<void> {
    await input.click({ timeout: 10_000 });
    await this.ui.boundItem(text).click({ timeout: 10_000 });
  }
}
