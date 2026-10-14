import type { Locator, Page } from '@playwright/test';
import { BackupFlows, type JobOutcome } from './backup.flows';
import type { SqlBackupType } from '../pages/backup-wizard.page';
import { COPY_STEPS, CopyWizardPage, RepositoriesViewPage, type CopyStep } from '../pages/bkA8-copy-wizard.page';

// Business flows for the "Backup Copy Job" wizard (Microsoft SQL Server) and for the source chains the copy cases need. Same rules as every
// flows file (standards/flows-layer.md): no assertions, no .env, no fixed waits; specs assert and own the test data.
//
// UNVERIFIED: the Backup Copy wizard was never opened during the UI exploration. Everything that touches it (openWizard, advanceTo,
// destination / retention / options helpers, the Repositories view) is text-based and inferred from the case folders and the
// Backup-for-Database wizard; the first live run must correct the locators in pages/bkA8-copy-wizard.page.ts. Job pages, the Run dialog,
// Delete, tree ticking and waitForResult are the shared BackupFlows ones (observed on Director 11.2.1.112232).

export interface SourceChainRequest {
  /** Name of the source backup job this case creates (and deletes, with its backups, in cleanup). */
  jobName: string;
  item: string;
  /** Databases of the item; omitted: the whole item. */
  databases?: string[];
  repo: string;
  /** Backup types to run in order. The first run of a new job is always a Full. Default ['Full']. */
  types?: SqlBackupType[];
}

export interface CopyRequest {
  name: string;
  item: string;
  databases?: string[];
  destination?: string;
  /** 'onDemand' (default) ticks "Do not schedule, run on demand"; 'leave' keeps the wizard's own schedule state. */
  schedule?: 'onDemand' | 'leave';
  retention?: { exactCopy?: boolean; count?: number; gfs?: { weekly: number; monthly: number; yearly: number } };
  immutableDays?: number;
  copyMode?: 'Active full' | 'Synthetic full';
  options?: { priority?: string; networkAcceleration?: string; networkEncryption?: string; transporterLoad?: number; bottleneckDetection?: boolean };
}

export interface TypeCounts {
  full: number;
  incremental: number;
  log: number;
}

export class CopyFlows {
  readonly wizard: CopyWizardPage;
  readonly repositories: RepositoriesViewPage;

  private readonly page: Page;
  private readonly backup: BackupFlows;
  private readonly copyJobs = new Set<string>();
  private readonly sourceJobs = new Set<string>();

  constructor(page: Page, backup: BackupFlows) {
    this.page = page;
    this.backup = backup;
    this.wizard = new CopyWizardPage(page);
    this.repositories = new RepositoriesViewPage(page);
  }

  // ---- bookkeeping for afterEach ----

  trackCopyJob(name: string): void {
    this.copyJobs.add(name);
  }

  trackSourceJob(name: string): void {
    this.sourceJobs.add(name);
  }

  // Best-effort cleanup: closes an open wizard, then deletes the copy jobs and the source jobs THIS case created, each with its backups
  // (the case created them; a precondition check in the spec makes sure nothing else of the database lives in those repositories).
  async cleanup(): Promise<void> {
    try {
      if (await this.isWizardOpen()) await this.backup.cancelWizard();
    } catch {
      /* best effort */
    }
    for (const name of [...this.copyJobs, ...this.sourceJobs]) {
      try {
        await this.backup.discardJobIfPresent(name, false);
      } catch {
        /* best effort */
      }
    }
    this.copyJobs.clear();
    this.sourceJobs.clear();
  }

  async isWizardOpen(): Promise<boolean> {
    return (await this.wizard.title.count()) > 0 && (await this.wizard.title.isVisible().catch(() => false));
  }

  // ---- open / navigate ----

  // Data Protection > + > Backup Copy Job (UNVERIFIED: a "Microsoft SQL Server" / "for Database" choice may follow, then the wizard opens on Source).
  async openWizard(): Promise<void> {
    await this.backup.gotoJobs();
    await this.backup.jobs.addButton.click({ timeout: 10_000 });
    await this.wizard.addMenuCopyItem.click({ timeout: 10_000 });
    try {
      await this.wizard.title.waitFor({ timeout: 8_000 });
    } catch {
      await this.wizard.sqlServerChoice.click({ timeout: 10_000 });
      await this.wizard.title.waitFor({ timeout: 30_000 });
    }
  }

  async next(options: { blocked?: boolean } = {}): Promise<void> {
    await this.backup.next(options);
  }

  async cancelWizard(): Promise<void> {
    await this.backup.cancelWizard();
  }

  // The steps the wizard really has, in order (the cases name five; the notes suggest fewer may exist).
  async presentSteps(): Promise<CopyStep[]> {
    const found: CopyStep[] = [];
    for (const step of COPY_STEPS) {
      if ((await this.wizard.stepTab(step).count()) > 0) found.push(step);
    }
    return found.length > 0 ? found : COPY_STEPS;
  }

  // Fills every step before `target` with the request's values (defaults: on demand, no retention change) and leaves the wizard on
  // `target`. False when the wizard has no such step (the caller records case-vs-ui).
  async advanceTo(target: CopyStep, request: CopyRequest): Promise<boolean> {
    const present = await this.presentSteps();
    const index = present.indexOf(target);
    if (index < 0) return false;
    for (let i = 0; i < index; i++) {
      await this.fillStep(present[i], request, !present.includes('Retention'));
      await this.next();
    }
    return true;
  }

  // The caller has ticked the sources on Step 1 already: walks through the remaining steps with the request's values and presses Finish.
  async completeFromSource(request: CopyRequest): Promise<void> {
    const present = await this.presentSteps();
    for (const step of present.slice(1)) {
      await this.next();
      await this.fillStep(step, request, !present.includes('Retention'));
    }
    await this.backup.wizard.finishButton.click({ timeout: 10_000 });
    this.trackCopyJob(request.name);
  }

  async clearField(field: Locator): Promise<void> {
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    await field.press('Delete');
    await field.press('Tab');
  }

  async fillStep(step: CopyStep, request: CopyRequest, retentionInline = false): Promise<void> {
    if (step === 'Source') await this.backup.selectSources([{ item: request.item, databases: request.databases }]);
    if (step === 'Destination') {
      if (request.destination) await this.backup.chooseDestination(request.destination);
      if (request.immutableDays !== undefined) await this.enableImmutability(request.immutableDays);
    }
    if (step === 'Schedule') {
      if ((request.schedule ?? 'onDemand') === 'onDemand' && !(await this.isChecked(this.wizard.onDemandCheckbox))) {
        await this.wizard.onDemandCheckbox.click({ timeout: 10_000 });
      }
      if (retentionInline) await this.applyRetention(request);
    }
    if (step === 'Retention') await this.applyRetention(request);
    if (step === 'Options') await this.applyOptions(request);
  }

  async applyRetention(request: CopyRequest): Promise<void> {
    const retention = request.retention;
    if (!retention) return;
    if (retention.exactCopy !== undefined) {
      const on = await this.isChecked(this.wizard.maintainExactCopy);
      if (on !== retention.exactCopy) await this.wizard.maintainExactCopy.click({ timeout: 10_000 });
    }
    if (retention.count !== undefined) await this.typeInto(this.wizard.retentionCountField(), String(retention.count));
    if (retention.gfs) await this.setGfs(retention.gfs);
  }

  async setGfs(gfs: { weekly: number; monthly: number; yearly: number }): Promise<void> {
    if (!(await this.isChecked(this.wizard.gfsToggle))) await this.wizard.gfsToggle.click({ timeout: 10_000 });
    await this.typeInto(this.wizard.gfsField('weekly'), String(gfs.weekly));
    await this.typeInto(this.wizard.gfsField('monthly'), String(gfs.monthly));
    await this.typeInto(this.wizard.gfsField('yearly'), String(gfs.yearly));
  }

  async applyOptions(request: CopyRequest): Promise<void> {
    await this.setJobName(request.name);
    const options = request.options;
    if (request.copyMode) await this.selectCopyMode(request.copyMode);
    if (!options) return;
    if (options.priority !== undefined) await this.pickOption('Job priority', options.priority);
    if (options.networkAcceleration !== undefined) await this.pickOption('Network acceleration', options.networkAcceleration);
    if (options.networkEncryption !== undefined) await this.pickOption('Network encryption', options.networkEncryption);
    if (options.transporterLoad !== undefined) await this.setTransporterLoad(options.transporterLoad);
    if (options.bottleneckDetection !== undefined) await this.setCheckbox(this.wizard.bottleneckCheckbox, options.bottleneckDetection);
  }

  // ---- Step 2: Destination ----

  // Texts the destination selector lists (open the combo, read, close). A disabled entry still appears in the list.
  async destinationItems(): Promise<string[]> {
    return this.comboItems(this.backup.wizard.destinationCombo);
  }

  async isDestinationEntryDisabled(name: string): Promise<boolean> {
    return this.backup.isDisabled(this.wizard.destinationEntry(name));
  }

  async destinationEntryHoverTexts(name: string): Promise<string[]> {
    return this.backup.hoverTexts(this.wizard.destinationEntry(name));
  }

  async destinationValue(): Promise<string> {
    return this.backup.wizard.destinationCombo.inputValue();
  }

  async closePopup(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  // Advanced setup: expands the row of a database and picks its own destination. UNVERIFIED row structure ("Click to expand").
  async setAdvancedDestination(database: string, repoName: string): Promise<void> {
    const row = this.page.getByText(database, { exact: true }).filter({ visible: true }).first();
    await row.click({ timeout: 10_000 });
    const combo = row.locator('xpath=following::input[1]');
    await combo.click({ timeout: 10_000 });
    await this.wizard.destinationEntry(repoName).click({ timeout: 10_000 });
  }

  async enableImmutability(days: number): Promise<void> {
    if (!(await this.isChecked(this.wizard.immutableToggle))) await this.wizard.immutableToggle.click({ timeout: 10_000 });
    await this.typeInto(this.wizard.immutableForField, String(days));
  }

  // ---- Step 5: Options ----

  async setJobName(name: string): Promise<void> {
    await this.typeInto(this.wizard.jobNameField, name);
  }

  async jobNameValue(): Promise<string> {
    return this.wizard.jobNameField.inputValue();
  }

  async optionItems(label: string): Promise<string[]> {
    return this.comboItems(this.wizard.fieldByLabel(label));
  }

  async optionValue(label: string): Promise<string> {
    return this.wizard.fieldByLabel(label).inputValue();
  }

  async pickOption(label: string, text: string): Promise<void> {
    const input = this.wizard.fieldByLabel(label);
    await input.click({ timeout: 10_000 });
    await this.wizard.boundListItem(text).click({ timeout: 10_000 });
  }

  async setTransporterLoad(value: number | string): Promise<void> {
    if (!(await this.isChecked(this.wizard.transporterLoadCheckbox)) && (await this.backup.isDisabled(this.wizard.transporterLoadField))) {
      await this.wizard.transporterLoadCheckbox.click({ timeout: 10_000 });
    }
    await this.typeInto(this.wizard.transporterLoadField, String(value));
  }

  async transporterLoadValue(): Promise<string> {
    return this.wizard.transporterLoadField.inputValue();
  }

  async setCheckbox(label: Locator, on: boolean): Promise<void> {
    if ((await this.isChecked(label)) !== on) await label.click({ timeout: 10_000 });
  }

  // Backup copy mode (Active full / Synthetic full): a visible option text, or a combo captioned "... mode". False when the wizard offers none.
  async selectCopyMode(mode: 'Active full' | 'Synthetic full'): Promise<boolean> {
    const direct = this.page.getByText(mode, { exact: false }).filter({ visible: true });
    if ((await direct.count()) > 0) {
      await direct.first().click({ timeout: 10_000 });
      return true;
    }
    const combo = this.wizard.fieldByLabel(/copy mode|Full backup/i);
    if ((await combo.count()) === 0) return false;
    await combo.click({ timeout: 10_000 });
    const item = this.wizard.boundListItem(mode);
    if ((await item.count()) === 0) return false;
    await item.click({ timeout: 10_000 });
    return true;
  }

  async closePasswordDialogIfShown(): Promise<boolean> {
    if (!(await this.wizard.passwordDialog.isVisible().catch(() => false))) return false;
    await this.wizard.passwordDialog.getByText('Cancel', { exact: true }).last().click({ timeout: 10_000 });
    return true;
  }

  // ---- create / run ----

  // The whole copy wizard in one call, ending on the saved job (default) or the wizard left open on the last step.
  async createCopyJob(request: CopyRequest, finish: 'finish' | 'stay' = 'finish'): Promise<void> {
    await this.openWizard();
    await this.advanceTo('Options', request);
    await this.fillStep('Options', request);
    if (finish === 'finish') {
      await this.backup.wizard.finishButton.click({ timeout: 10_000 });
      this.trackCopyJob(request.name);
    }
  }

  // Source backup chain: creates a Backup-for-Database job on the item / databases, runs it (Full) and then one run per further type.
  // Returns the outcome of each run. The job is tracked for cleanup (deleted with its backups).
  async seedSourceChain(request: SourceChainRequest, runTimeoutMs = 300_000): Promise<JobOutcome[]> {
    const types = request.types ?? ['Full'];
    this.trackSourceJob(request.jobName);
    await this.backup.createJob({
      name: request.jobName,
      sources: [{ item: request.item, databases: request.databases }],
      destination: request.repo,
      finish: 'finishAndRun',
    });
    await this.backup.openJob(request.jobName);
    const outcomes: JobOutcome[] = [await this.backup.waitForResult(runTimeoutMs)];
    for (const type of types.slice(1)) outcomes.push(await this.runSource(request.jobName, type, runTimeoutMs));
    return outcomes;
  }

  // One more run of an existing source job with the given SQL backup type.
  async runSource(jobName: string, type: SqlBackupType, runTimeoutMs = 300_000): Promise<JobOutcome> {
    await this.backup.openJob(jobName);
    await this.backup.runOpenJob({ sqlBackupType: type });
    return this.backup.waitForResult(runTimeoutMs);
  }

  // Runs a (copy) job from its page and waits for the end of the run.
  async runJob(jobName: string, runTimeoutMs = 600_000): Promise<JobOutcome> {
    await this.backup.openJob(jobName);
    await this.backup.runOpenJob();
    return this.backup.waitForResult(runTimeoutMs);
  }

  // The status line of a job ("Last run was successful", ...).
  async readLastStatus(jobName: string): Promise<string> {
    await this.backup.openJob(jobName);
    return this.backup.readStatusLine();
  }

  // Visible texts of an open job page (events, per-database status lines, error text).
  async jobPageTexts(jobName: string): Promise<string[]> {
    await this.backup.openJob(jobName);
    return this.backup.visibleTexts();
  }

  // ---- reading a repository ----

  // Leaf texts of the repository's backup / recovery-point listing. UNVERIFIED navigation: Settings > Repositories > <repo> > Backups.
  async repositoryTexts(repoName: string): Promise<string[]> {
    await this.repositories.goto();
    if ((await this.repositories.repositoriesTab.count()) > 0) await this.repositories.repositoriesTab.click({ timeout: 10_000 });
    await this.repositories.repositoryRow(repoName).click({ timeout: 20_000 });
    try {
      await this.repositories.backupsTab.click({ timeout: 8_000 });
    } catch {
      /* the listing may already be shown */
    }
    return this.backup.visibleTexts();
  }

  // Counts recovery-point type words in a listing. "Incremental" and "Differential" are counted together (the copy shows a Differential
  // as Incremental per case NJM-154875).
  typeCounts(texts: string[]): TypeCounts {
    // UNVERIFIED: a recovery-point row is assumed to show its type as a short leaf text that starts with the type word.
    const count = (pattern: RegExp): number => texts.filter((t) => t.length <= 24 && pattern.test(t)).length;
    return { full: count(/^Full\b/), incremental: count(/^(Incremental|Differential)\b/), log: count(/^Log\b/) };
  }

  // Tokens that look like a date or a time (used to compare source and target timestamps without knowing the UI format).
  timestampTokens(texts: string[]): string[] {
    return texts.filter((t) => /\d{1,2}:\d{2}/.test(t) || /\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/.test(t));
  }

  // ---- low level ----

  async isChecked(label: Locator): Promise<boolean> {
    if ((await label.count()) === 0) return false;
    return label.evaluate((element) => {
      const el = element as HTMLElement;
      const forId = el.getAttribute('for');
      const input = (forId ? document.getElementById(forId) : null) ?? el.querySelector('input') ?? el.parentElement?.querySelector('input[type=checkbox]');
      if (input instanceof HTMLInputElement) return input.checked;
      return /checked/.test(`${el.className} ${el.parentElement?.className ?? ''}`);
    });
  }

  // Opens a combo and returns what it lists: boundlist items when the popup is one, otherwise the new leaf texts.
  async comboItems(input: Locator): Promise<string[]> {
    const before = await this.backup.visibleTexts();
    await input.click({ timeout: 10_000 });
    try {
      await this.wizard.boundListItems().first().waitFor({ timeout: 4_000 });
    } catch {
      /* the popup may be a div list */
    }
    const bound = (await this.wizard.boundListItems().allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const items = bound.length > 0 ? bound : (await this.backup.visibleTexts()).filter((t) => !before.includes(t));
    await this.closePopup();
    return items;
  }

  // fill() does not reach Ext form values: type slowly, then Tab.
  async typeInto(field: Locator, value: string): Promise<void> {
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    await field.pressSequentially(value, { delay: 80 });
    await field.press('Tab');
  }
}
