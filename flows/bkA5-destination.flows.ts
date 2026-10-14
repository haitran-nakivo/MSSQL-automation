import type { Locator, Page } from '@playwright/test';
import { BkA5DestinationPage } from '../pages/bkA5-destination.page';
import type { SqlBackupType } from '../pages/backup-wizard.page';
import { BackupFlows } from './backup.flows';
import type { JobOutcome } from './backup.flows';

// Flows for the Destination step ("Advanced setup", per-database destination, "Use an existing backup as a target") and for the jobs
// that the "existing backup" cases create, run, edit and delete. Same rules as every flows file (standards/flows-layer.md): no
// assertions, no .env, no fixed sleeps; the specs assert and own the test data. Built on BackupFlows (shared, not edited).
// UNVERIFIED: all per-database locators come from pages/bkA5-destination.page.ts (inferred from notes, never seen live); the Edit button of a
// job page, the "Save & Run" sequence (Change-destination question, then "Run this job?") and the grid/popup structure of the backup
// list are guesses from nakivo-db-backup-job-management / nakivo-db-backup-job-wizard.

export type PickOutcome = 'blocked' | 'confirm' | 'selected';

export interface ExistingBackupPick {
  /** The text that was clicked in the list (a backup name or a job name). */
  clicked: string;
  outcome: PickOutcome;
  /** Text of the "Cannot use" pop-up when the outcome is 'blocked'. */
  blockedText: string;
}

const LIST_HEADERS = /^(Backup name|Job name|Name|Job|Backup|Size|Encryption)$/;

export class BkA5DestinationFlows {
  readonly p: BkA5DestinationPage;
  readonly backup: BackupFlows;

  private readonly page: Page;

  constructor(page: Page, backup: BackupFlows) {
    this.page = page;
    this.backup = backup;
    this.p = new BkA5DestinationPage(page);
  }

  // ---- wizard navigation ----

  // Data Protection > + > Backup for Database, tick the databases of an item, Next: the wizard shows Step 2 (Destination).
  async startAtDestination(item: string, databases: string[]): Promise<void> {
    await this.backup.openWizard();
    await this.backup.selectSources([{ item, databases }]);
    await this.backup.next();
    await this.backup.wizard.advancedSetupLink.waitFor({ timeout: 30_000 });
  }

  async toggleDatabase(item: string, db: string): Promise<void> {
    await this.backup.selectSources([{ item, databases: [db] }]);
  }

  async goToSource(): Promise<void> {
    await this.backup.goToStep('Source');
    await this.backup.wizard.selectionSummary.waitFor({ timeout: 15_000 });
  }

  async goToDestination(): Promise<void> {
    await this.backup.goToStep('Destination');
    await this.backup.wizard.advancedSetupLink.waitFor({ timeout: 15_000 });
  }

  async selectionSummaryText(): Promise<string> {
    return (await this.backup.wizard.selectionSummary.innerText()).replace(/\s+/g, ' ').trim();
  }

  // ---- Advanced setup / per-database block ----

  // Opens Advanced setup unless a database row or block is already shown.
  async openAdvancedSetup(): Promise<void> {
    if (!(await this.hasDatabaseControls())) {
      await this.backup.wizard.advancedSetupLink.click({ timeout: 10_000 });
    }
    await this.p.expandHandles.or(this.p.useExistingLabels).first().waitFor({ timeout: 15_000 });
  }

  async hasDatabaseControls(): Promise<boolean> {
    return (await this.p.expandHandles.count()) > 0 || (await this.p.useExistingLabels.count()) > 0;
  }

  // Switches back from Advanced setup when the page offers a way (a "Fast setup" link). False when no such control was found.
  async closeAdvancedSetup(): Promise<boolean> {
    const link = this.page.getByText('Fast setup', { exact: false }).filter({ visible: true }).first();
    if ((await link.count()) === 0) return false;
    await link.click({ timeout: 10_000 });
    return true;
  }

  async isExpanded(db: string): Promise<boolean> {
    return this.p.useExistingFor(db).isVisible();
  }

  async expand(db: string): Promise<void> {
    await this.p.handleFor(db).click({ timeout: 10_000 });
    await this.p.useExistingFor(db).waitFor({ timeout: 10_000 });
  }

  async ensureExpanded(db: string): Promise<void> {
    if (await this.isExpanded(db)) return;
    if ((await this.p.handleFor(db).count()) > 0) await this.expand(db);
    else await this.p.useExistingFor(db).waitFor({ timeout: 10_000 });
  }

  // Clicks the row handle of an expanded database and waits until its controls are hidden. True when they disappeared.
  async collapse(db: string): Promise<boolean> {
    await this.p.handleFor(db).click({ timeout: 10_000 });
    try {
      await this.p.useExistingFor(db).waitFor({ state: 'hidden', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  // ---- destinations ----

  // The "Destination:" combo above Advanced setup: open it and pick a repository by name (list closes when focus leaves).
  async setTopDestination(repo: string): Promise<void> {
    await this.p.topCombo.click({ timeout: 10_000 });
    await this.backup.wizard.destinationOption(repo).click({ timeout: 10_000 });
  }

  async topDestinationValue(): Promise<string> {
    return this.p.topCombo.inputValue();
  }

  async setDatabaseDestination(db: string, repo: string): Promise<void> {
    await this.ensureExpanded(db);
    await this.p.dbCombo(db).click({ timeout: 10_000 });
    await this.backup.wizard.destinationOption(repo).click({ timeout: 10_000 });
  }

  async databaseDestinationValue(db: string): Promise<string> {
    await this.ensureExpanded(db);
    return this.p.dbCombo(db).inputValue();
  }

  // ---- "Use an existing backup as a target" ----

  // State of an Ext checkbox/combo from its label or input: checked marker, disabled marker (class on the field or its ancestors).
  async controlState(target: Locator): Promise<{ checked: boolean; disabled: boolean }> {
    return target.evaluate((element) => {
      let checked = false;
      let disabled = (element as HTMLInputElement).disabled === true;
      let node: HTMLElement | null = element as HTMLElement;
      for (let depth = 0; depth < 5 && node; depth++, node = node.parentElement) {
        if (/x-form-cb-checked|x-item-checked/.test(node.className)) checked = true;
        if (/x-item-disabled|x-disabled|x-form-readonly/.test(node.className)) disabled = true;
        const inputs = Array.from(node.querySelectorAll('input')) as HTMLInputElement[];
        for (const input of inputs) {
          if (input.getAttribute('aria-checked') === 'true' || (input.type === 'checkbox' && input.checked)) checked = true;
        }
        if (inputs.length > 0 && depth >= 1) break;
      }
      return { checked, disabled };
    });
  }

  async useExistingState(db: string): Promise<{ checked: boolean; disabled: boolean }> {
    await this.ensureExpanded(db);
    return this.controlState(this.p.useExistingFor(db));
  }

  async backupComboState(db: string): Promise<{ checked: boolean; disabled: boolean }> {
    await this.ensureExpanded(db);
    return this.controlState(this.p.backupCombo(db));
  }

  async tickUseExisting(db: string): Promise<void> {
    await this.ensureExpanded(db);
    await this.p.useExistingFor(db).click({ timeout: 10_000 });
  }

  async backupComboValue(db: string): Promise<string> {
    return this.p.backupCombo(db).inputValue();
  }

  async backupComboPlaceholder(db: string): Promise<string> {
    return (await this.p.backupCombo(db).getAttribute('placeholder')) ?? '';
  }

  // Opens the "Select a backup" list and returns the leaf texts that appeared (column headers removed). The popup stays open.
  async openBackupList(db: string): Promise<string[]> {
    const texts = await this.newTextsAfter(() => this.p.backupCombo(db).click({ timeout: 10_000, force: true }));
    return texts.filter((text) => !LIST_HEADERS.test(text));
  }

  // Closes an open popup list by clicking neutral text (a list closes when focus leaves).
  async closeList(db: string): Promise<void> {
    await this.p.dbName(db).click({ timeout: 10_000 });
  }

  // With the list open, clicks the entry that contains `text`, then reports what the Director answered.
  async pickBackup(text: string): Promise<ExistingBackupPick> {
    await this.p.backupEntry(text).click({ timeout: 10_000 });
    return this.readPickOutcome(text);
  }

  private async readPickOutcome(clicked: string): Promise<ExistingBackupPick> {
    try {
      await this.p.blockedDialog.or(this.p.confirmDialog).first().waitFor({ timeout: 8_000 });
    } catch {
      return { clicked, outcome: 'selected', blockedText: '' };
    }
    if (await this.p.blockedDialog.isVisible()) {
      const blockedText = (await this.p.blockedDialog.innerText()).replace(/\s+/g, ' ').trim();
      return { clicked, outcome: 'blocked', blockedText };
    }
    return { clicked, outcome: 'confirm', blockedText: '' };
  }

  async dismissBlocked(): Promise<void> {
    await this.p.clickBlockedOk();
    await this.p.blockedDialog.waitFor({ state: 'hidden', timeout: 10_000 });
  }

  async proceedWithBackup(): Promise<void> {
    await this.p.clickProceed();
    await this.p.confirmDialog.waitFor({ state: 'hidden', timeout: 10_000 });
  }

  // Tries the backups of the open repository one by one (up to `limit` list texts) until one is free; leaves it selected.
  // Returns the text that was chosen, or null when every tried backup is used by a live job (or the list is empty).
  async selectFreeBackup(db: string, limit = 8): Promise<string | null> {
    for (let index = 0; index < limit; index++) {
      const texts = await this.openBackupList(db);
      if (index >= texts.length) return null;
      const pick = await this.pickBackup(texts[index]);
      if (pick.outcome === 'blocked') {
        await this.dismissBlocked();
        continue;
      }
      if (pick.outcome === 'confirm') {
        await this.proceedWithBackup();
        return pick.clicked;
      }
      return pick.clicked;
    }
    return null;
  }

  // ---- reading positions ----

  // Names in the order they appear from top to bottom. With `rightOfText`, only text to the right of that anchor counts (the Source
  // step's "Drag items to set processing priority" list sits right of the tree).
  async verticalOrder(names: string[], rightOfText?: string): Promise<string[]> {
    return this.page.evaluate(
      ({ names: wanted, anchor }) => {
        const leaves = (Array.from(document.querySelectorAll('*')) as HTMLElement[]).filter((el) => el.children.length === 0 && el.offsetParent !== null);
        let minLeft = -1;
        if (anchor) {
          const found = leaves.find((el) => (el.textContent ?? '').includes(anchor));
          if (found) minLeft = found.getBoundingClientRect().left - 10;
        }
        const tops: { name: string; top: number }[] = [];
        for (const name of wanted) {
          const hit = leaves.find((el) => el.getBoundingClientRect().left >= minLeft && (el.textContent ?? '').trim().includes(name));
          if (hit) tops.push({ name, top: hit.getBoundingClientRect().top });
        }
        return tops.sort((a, b) => a.top - b.top).map((entry) => entry.name);
      },
      { names, anchor: rightOfText },
    );
  }

  // ---- jobs used by the existing-backup cases ----

  // Wizard from Destination on: Next, run on demand, Next, job name, Finish (job saved, not run). Leaves the job page open.
  async finishFromDestination(jobName: string): Promise<void> {
    await this.backup.next();
    await this.backup.setOnDemand();
    await this.backup.next();
    await this.backup.setJobName(jobName);
    await this.backup.wizard.finishButton.click({ timeout: 10_000 });
    await this.backup.jobs.statusLine.waitFor({ timeout: 60_000 });
  }

  // Same, but Finish & Run (the run dialog's Run is clicked); the caller waits for the result.
  async finishAndRunFromDestination(jobName: string, type?: SqlBackupType): Promise<void> {
    await this.backup.next();
    await this.backup.setOnDemand();
    await this.backup.next();
    await this.backup.setJobName(jobName);
    await this.backup.wizard.finishAndRunButton.click({ timeout: 10_000 });
    await this.backup.jobs.runDialog.waitFor({ timeout: 15_000 });
    await this.chooseRunTypeIfOffered(type);
    await this.backup.jobs.runDialogRunButton.click({ timeout: 10_000 });
  }

  // Creates an on-demand job on one database to a repository, runs it once (Full) and waits. Returns how the run ended.
  async createAndRunJob(jobName: string, item: string, db: string, repo: string, timeoutMs = 300_000): Promise<JobOutcome> {
    await this.backup.createJob({ name: jobName, sources: [{ item, databases: [db] }], destination: repo, finish: 'finishAndRun' });
    return this.waitForRun(timeoutMs);
  }

  // Runs the open job again from its page; the dialog's SQL backup type is set when the dialog offers it.
  async runOpenJobAs(type: SqlBackupType | undefined, timeoutMs = 300_000): Promise<JobOutcome> {
    await this.backup.jobs.runButton.click({ timeout: 10_000 });
    await this.backup.jobs.runDialog.waitFor({ timeout: 15_000 });
    await this.chooseRunTypeIfOffered(type);
    await this.backup.jobs.runDialogRunButton.click({ timeout: 10_000 });
    return this.waitForRun(timeoutMs);
  }

  // Opens the Run dialog of the open job without confirming it; returns the dialog text.
  async openRunDialogText(): Promise<string> {
    await this.backup.jobs.runButton.click({ timeout: 10_000 });
    await this.backup.jobs.runDialog.waitFor({ timeout: 15_000 });
    return (await this.backup.jobs.runDialog.innerText()).replace(/\s+/g, ' ').trim();
  }

  // Confirms a Run dialog that openRunDialogText left open, then waits for the end of the run.
  async confirmOpenRunDialog(type: SqlBackupType | undefined, timeoutMs = 300_000): Promise<JobOutcome> {
    await this.chooseRunTypeIfOffered(type);
    await this.backup.jobs.runDialogRunButton.click({ timeout: 10_000 });
    return this.waitForRun(timeoutMs);
  }

  private async chooseRunTypeIfOffered(type?: SqlBackupType): Promise<void> {
    const combo = this.backup.jobs.runDialogSqlBackupTypeField();
    if (type === undefined || (await combo.count()) === 0) return;
    await combo.click({ timeout: 10_000 });
    await this.backup.wizard.boundListItem(type).click({ timeout: 10_000 });
  }

  // A run is over when no "Running (" text is left and the status line says "Last run ...". The old status text stays on the page while a
  // re-run starts, so first wait (briefly) for "Running (" to show up.
  async waitForRun(timeoutMs = 300_000): Promise<JobOutcome> {
    try {
      await this.page.getByText(/Running \(/).filter({ visible: true }).first().waitFor({ timeout: 20_000 });
    } catch {
      // A run that ends within a second never shows "Running (": the status line below tells.
    }
    return this.backup.waitForResult(timeoutMs);
  }

  // Opens a job's Edit wizard from its job page.
  async openEdit(jobName: string): Promise<void> {
    await this.backup.openJob(jobName);
    await this.page.getByText('Edit', { exact: true }).filter({ visible: true }).first().click({ timeout: 10_000 });
    await this.backup.wizard.title.waitFor({ timeout: 30_000 });
  }

  // Save & Run in the Edit wizard: answers "Change backup destination?" with Change (keep old backup) when it is asked, then runs.
  async saveAndRun(type?: SqlBackupType, timeoutMs = 300_000): Promise<JobOutcome> {
    await this.backup.wizard.saveAndRunButton.click({ timeout: 10_000 });
    await this.p.changeDestinationDialog.or(this.backup.jobs.runDialog).first().waitFor({ timeout: 20_000 });
    if (await this.p.changeDestinationDialog.isVisible()) {
      await this.p.clickChange();
      await this.backup.jobs.runDialog.waitFor({ timeout: 20_000 });
    }
    await this.chooseRunTypeIfOffered(type);
    await this.backup.jobs.runDialogRunButton.click({ timeout: 10_000 });
    return this.waitForRun(timeoutMs);
  }

  // Lines of the job page that start with an event time or text; used to attach what the page said.
  async pageTextContaining(pattern: RegExp): Promise<string[]> {
    return (await this.backup.visibleTexts()).filter((text) => pattern.test(text));
  }

  // ---- reading new text ----

  // Texts that appear after `action` (about 0.25 to 4 s); the same technique BackupFlows.hoverTexts uses for tooltips.
  async newTextsAfter(action: () => Promise<void>, timeoutMs = 4_000): Promise<string[]> {
    const before = await this.backup.visibleTexts();
    await action();
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
        { timeout: timeoutMs, polling: 250 },
      );
    } catch {
      return [];
    }
    return (await this.backup.visibleTexts()).filter((text) => !before.includes(text));
  }
}
