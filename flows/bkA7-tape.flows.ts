import type { Locator, Page } from '@playwright/test';
import { BackupFlows, type JobOutcome } from './backup.flows';
import { BkA7TapePage } from '../pages/bkA7-tape.page';
import type { A7Setup } from '../helpers/bkA7-env';
import { viewingPause } from '../helpers/viewing-pause';

// Backup Copy to Tape flows of assignment A7. Rules: no assertions, no .env, no fixed waits; every wait is on an observable state with an explicit timeout.
// UNVERIFIED throughout: no tape hardware existed during the owner-approved exploration and the Backup Copy wizard was never opened, so every locator
// is text based and inferred from the case texts. The wizard is walked generically (Source, Destination, Schedule, Retention, Options): at each step the
// controls the request needs are filled when they are visible, then Next / Finish. The first real run on a tape lab will show what to tighten.

export interface TapeCopyRequest {
  name: string;
  /** Names of the backups (as listed in the Source step) to copy. */
  sources: string[];
  /** Tape library or standalone drive to copy to (text of the destination list entry). */
  target: string;
  mediaPool?: string;
  maxDrives?: number;
  /** Visible text of the copy mode to select ("Forever-incremental" or "Incremental with active full"). */
  mode?: string;
  finish: 'finish' | 'finishAndRun' | 'stay';
}

export interface RunSamples {
  maxActive: number;
  maxQueued: number;
  samples: number;
}

export class BkA7TapeFlows {
  readonly ui: BkA7TapePage;
  readonly backup: BackupFlows;
  private readonly page: Page;

  constructor(page: Page, backup: BackupFlows) {
    this.page = page;
    this.backup = backup;
    this.ui = new BkA7TapePage(page);
  }

  // ---- source SQL backup (an existing Backup for Database job that has run) ----

  // Creates the SQL backup job on demand and runs it once; returns the outcome of that run. The job stays open on its page.
  async createAndRunSourceJob(setup: A7Setup, jobName: string, databases?: string[]): Promise<JobOutcome> {
    await this.backup.createJob({
      name: jobName,
      sources: [{ item: setup.item, databases: databases ?? [setup.db] }],
      destination: setup.repo,
      finish: 'finishAndRun',
    });
    await this.backup.jobs.statusLine.waitFor({ timeout: 60_000 });
    return this.backup.waitForResult(600_000);
  }

  // Runs the open SQL backup job again (Full), to add a recovery point.
  async rerunSourceJob(): Promise<JobOutcome> {
    const jobs = this.backup.jobs;
    await jobs.runButton.click({ timeout: 10_000 });
    await jobs.runDialog.waitFor({ timeout: 15_000 });
    // The SQL backup type combo defaults to Log after a Full run (Log fails on a SIMPLE database): choose Full explicitly.
    if ((await jobs.runDialog.getByText('SQL backup type', { exact: false }).count()) > 0) {
      await jobs.runDialogSqlBackupTypeField().click({ timeout: 10_000 });
      await this.backup.wizard.boundListItem('Full').click({ timeout: 10_000 });
    }
    await jobs.runDialogRunButton.click({ timeout: 10_000 });
    return this.backup.waitForResult(600_000);
  }

  // ---- Backup Copy wizard ----

  async openCopyWizard(): Promise<void> {
    await this.backup.gotoJobs();
    await this.backup.jobs.addButton.click({ timeout: 10_000 });
    await this.ui.backupCopyMenuItem().click({ timeout: 10_000 });
    await this.ui.wizardTitle().waitFor({ timeout: 30_000 });
  }

  // Whole Backup Copy wizard for a tape target. Returns the number of steps walked after Source/Destination.
  async createTapeCopyJob(request: TapeCopyRequest): Promise<number> {
    const b = this.backup;
    await this.openCopyWizard();
    // Source: tick every requested backup (tree/grid rows with checkboxes, like the Backup wizard).
    for (const source of request.sources) await b.wizard.treeCheckbox(source).click({ timeout: 15_000 });
    await b.next();
    // Destination: the tape library / drive from the destination combo, then the media pool when asked.
    await b.wizard.destinationCombo.click({ timeout: 10_000 });
    await b.wizard.destinationOption(request.target).click({ timeout: 10_000 });
    if (request.mediaPool) {
      const pool = this.page.getByText(request.mediaPool, { exact: false }).filter({ visible: true }).last();
      if ((await pool.count()) > 0) await pool.click({ timeout: 10_000 });
    }
    await b.next();
    // The remaining steps: fill what is visible, Next until Finish is offered.
    let walked = 0;
    for (let i = 0; i < 6; i++) {
      if ((await b.wizard.onDemandCheckbox.count()) > 0 && i === 0) await b.setOnDemand();
      if (request.mode && (await this.ui.textOption(request.mode).count()) > 0) await this.ui.textOption(request.mode).click({ timeout: 10_000 });
      if (request.maxDrives !== undefined && (await this.ui.maxDrivesInput().count()) > 0) {
        await this.typeInto(this.ui.maxDrivesInput(), String(request.maxDrives));
      }
      if ((await b.wizard.jobNameField.count()) > 0) await b.setJobName(request.name);
      if ((await b.wizard.finishButton.count()) > 0) break;
      await b.next();
      walked++;
    }
    if (request.finish === 'finish') await b.wizard.finishButton.click({ timeout: 10_000 });
    if (request.finish === 'finishAndRun') {
      await b.wizard.finishAndRunButton.click({ timeout: 10_000 });
      if ((await b.jobs.runDialog.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false)) === true) {
        await b.jobs.runDialogRunButton.click({ timeout: 10_000 });
      }
    }
    return walked;
  }

  // Edit wizard of a Backup Copy job: walks the steps until the mode text is visible, selects it and saves. False when no step showed it.
  async changeCopyMode(jobName: string, mode: string): Promise<boolean> {
    const b = this.backup;
    await b.openJob(jobName);
    await b.jobs.manageButton.click({ timeout: 10_000 });
    await this.page.getByText('Edit', { exact: true }).filter({ visible: true }).last().click({ timeout: 10_000 });
    await b.wizard.title.or(this.ui.wizardTitle()).first().waitFor({ timeout: 30_000 });
    let applied = false;
    for (let i = 0; i < 6 && !applied; i++) {
      if ((await this.ui.textOption(mode).count()) > 0) {
        await this.ui.textOption(mode).click({ timeout: 10_000 });
        applied = true;
        break;
      }
      if ((await b.wizard.nextButton.count()) === 0) break;
      await b.next();
    }
    if (applied) {
      await b.wizard.saveButton.click({ timeout: 10_000 });
      await b.wizard.title.or(this.ui.wizardTitle()).first().waitFor({ state: 'hidden', timeout: 30_000 });
    } else {
      await b.wizard.cancelButton.first().click({ timeout: 10_000 });
    }
    return applied;
  }

  // Runs the open Backup Copy job from its page ("Run this job?" dialog when it opens).
  async runOpenCopyJob(): Promise<void> {
    await this.backup.jobs.runButton.click({ timeout: 10_000 });
    const opened = await this.backup.jobs.runDialog.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    if (opened) await this.backup.jobs.runDialogRunButton.click({ timeout: 10_000 });
  }

  // While the open job runs, samples the page every second: the most rows seen in an active state and in a queued state. Returns when the run ended.
  async sampleRun(timeoutMs: number): Promise<RunSamples> {
    try {
      await this.page.waitForFunction(
        () => {
          const w = window as unknown as { __a7?: { maxActive: number; maxQueued: number; samples: number } };
          const state = (w.__a7 ??= { maxActive: 0, maxQueued: 0, samples: 0 });
          const rows = Array.from(document.querySelectorAll<HTMLElement>('.x-grid-row')).filter((r) => r.offsetParent !== null);
          const active = rows.filter((r) => /Running|In progress|Writing|Processing/i.test(r.innerText)).length;
          const queued = rows.filter((r) => /Queued|Waiting/i.test(r.innerText)).length;
          state.maxActive = Math.max(state.maxActive, active);
          state.maxQueued = Math.max(state.maxQueued, queued);
          state.samples++;
          const text = document.body.innerText;
          return !/Running \(/.test(text) && /Last run (was|has)/.test(text);
        },
        undefined,
        { timeout: timeoutMs, polling: 1_000 },
      );
    } catch {
      // timeout: the samples taken so far are still returned
    }
    return this.page.evaluate(() => {
      const w = window as unknown as { __a7?: { maxActive: number; maxQueued: number; samples: number } };
      return w.__a7 ?? { maxActive: 0, maxQueued: 0, samples: 0 };
    });
  }

  // ---- Tape tab ----

  // Whether the Tape tab lists a library / drive with this name (the specs end ABORTED when it does not).
  async tapeResourceExists(name: string): Promise<boolean> {
    await this.page.goto(BkA7TapePage.settingsRoute);
    await this.ui.tapeTab().click({ timeout: 30_000 });
    try {
      await this.ui.tapeResource(name).waitFor({ timeout: 15_000 });
      return true;
    } catch {
      return false;
    }
  }

  // Configuration > Tape > <resource> (library or standalone drive); returns the texts of the contents rows.
  async openTapeResource(name: string): Promise<string[]> {
    await this.page.goto(BkA7TapePage.settingsRoute);
    await this.ui.tapeTab().click({ timeout: 30_000 });
    await this.ui.tapeResource(name).click({ timeout: 15_000 });
    return this.contentTexts();
  }

  async contentTexts(): Promise<string[]> {
    const rows = this.ui.contentRows();
    try {
      await rows.first().waitFor({ timeout: 15_000 });
    } catch {
      return [];
    }
    return (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  // ---- tape recovery wizard (UNVERIFIED: steps Source list, Destination, Schedule, Options) ----

  // Texts and disabled flags of every row of the wizard list on the current step.
  async wizardRows(): Promise<{ text: string; disabled: boolean }[]> {
    const rows = this.page.locator(".x-grid-row:visible, .x-boundlist-item:visible, [class*=\"list-item\"]:visible");
    const count = await rows.count();
    const found: { text: string; disabled: boolean }[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      found.push({ text: (await row.innerText()).replace(/\s+/g, " ").trim(), disabled: await this.backup.isDisabled(row) });
    }
    return found;
  }

  // Selects a row of the wizard list unless the wizard already has it selected (Next enabled).
  async selectWizardRow(text: string): Promise<void> {
    await this.ui.wizardRow(text).click({ timeout: 15_000 });
  }

  // Walks the tape recovery wizard with Next until the step that shows the Job name field (Options) or the final button. Returns the number of Next presses.
  async walkToOptions(backupText: string, repo: string): Promise<number> {
    let steps = 0;
    for (let i = 0; i < 8; i++) {
      if (i === 0 && (await this.isDisabled(this.ui.nextButton()))) await this.selectWizardRow(backupText);
      if (i === 1) await this.selectWizardRow(repo);
      if ((await this.backup.wizard.jobNameField.count()) > 0) break;
      await this.ui.nextButton().waitFor({ timeout: 15_000 });
      await this.next();
      steps++;
    }
    return steps;
  }

  // Completes the tape recovery wizard for a backup and a destination repository; presses the final button when submit is true.
  async completeTapeRecovery(backupText: string, repo: string, submit: boolean): Promise<{ steps: number; submitted: boolean }> {
    const steps = await this.walkToOptions(backupText, repo);
    let submitted = false;
    if (submit) {
      await this.ui.finishButton().click({ timeout: 15_000 });
      submitted = true;
    }
    return { steps, submitted };
  }

  // ---- Global Search (UNVERIFIED) ----

  async globalSearch(text: string): Promise<void> {
    await this.page.goto("/c/main");
    const input = this.ui.globalSearchInput();
    await input.waitFor({ timeout: 30_000 });
    await input.click({ timeout: 10_000 });
    await input.pressSequentially(text, { delay: 80 });
    await input.press("Enter");
  }

  // ---- tape recovery ----

  // From the open tape resource: select the backup row and open Recover. Returns the visible menu entry texts after the click.
  async openRecoverMenuFor(backupText: string): Promise<void> {
    await this.ui.contentRow(backupText).click({ timeout: 15_000 });
    await this.ui.recoverButton().click({ timeout: 10_000 });
  }

  async chooseRecoverToRepository(): Promise<void> {
    await this.ui.recoverToRepositoryItem().click({ timeout: 10_000 });
    await this.ui.recoveryWizardTitle().waitFor({ timeout: 30_000 });
  }

  async next(): Promise<void> {
    await this.ui.nextButton().click({ timeout: 10_000 });
    await viewingPause();
  }

  // Disabled state of any control (class based, as BackupFlows.isDisabled).
  async isDisabled(target: Locator): Promise<boolean> {
    return this.backup.isDisabled(target);
  }

  async cancelWizard(): Promise<void> {
    if (await this.ui.cancelButton().count()) await this.ui.cancelButton().click({ timeout: 10_000 });
  }

  private async typeInto(field: Locator, value: string): Promise<void> {
    await field.click({ timeout: 10_000 });
    await field.press('Control+A');
    await field.pressSequentially(value, { delay: 80 });
    await field.press('Tab');
  }
}
