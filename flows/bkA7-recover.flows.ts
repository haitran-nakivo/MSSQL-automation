import type { Page } from '@playwright/test';
import { BackupFlows } from './backup.flows';
import { BkA7RecoverPage } from '../pages/bkA7-recover.page';
import { viewingPause } from '../helpers/viewing-pause';

// Recovery-side flows of assignment A7 (encryption cases ENC-04, ENC-07, ENC-08): drive the Recover wizard of a job, read Activities and the
// repository Backups list. Rules: no assertions, no .env, no fixed waits; every wait is on an observable state with an explicit timeout.
// UNVERIFIED: the Recover wizard was never opened live, so this driver is generic: it follows the wizard with Next until a final button
// appears and fills a password only when a password input shows. The first real run will show what must be tightened.

export type ActivityOutcome = 'Completed' | 'Failed' | 'Stopped' | 'timeout';

export interface RecoveryRun {
  /** A password input appeared and was filled. */
  passwordPrompted: boolean;
  /** The wizard reached its last step and the final button was pressed. */
  submitted: boolean;
  /** Steps walked (Next presses). */
  steps: number;
  /** Texts mentioning a password that the wizard showed (errors, hints). */
  passwordMessages: string[];
}

export class BkA7RecoverFlows {
  readonly ui: BkA7RecoverPage;
  readonly backup: BackupFlows;
  private readonly page: Page;

  constructor(page: Page, backup: BackupFlows) {
    this.page = page;
    this.backup = backup;
    this.ui = new BkA7RecoverPage(page);
  }

  // Job page > Recover. The button may open a menu of recovery types: then the database entry is chosen. True when a wizard title showed.
  async openRecover(): Promise<boolean> {
    await this.ui.recoverButton().click({ timeout: 10_000 });
    const menu = this.ui.databaseRecoveryMenuItem();
    const wizard = this.ui.wizardTitle();
    try {
      await wizard.or(menu).first().waitFor({ timeout: 15_000 });
    } catch {
      return false;
    }
    if (!(await wizard.isVisible())) await menu.click({ timeout: 10_000 });
    try {
      await wizard.waitFor({ timeout: 30_000 });
      return true;
    } catch {
      return false;
    }
  }

  // Walks the open recovery wizard with Next until the final button; fills `password` when a password input shows; presses the final button
  // when `submit` is true. Does not wait for the result (see waitActivity).
  async walkWizard(options: { password?: string; submit: boolean }): Promise<RecoveryRun> {
    const run: RecoveryRun = { passwordPrompted: false, submitted: false, steps: 0, passwordMessages: [] };
    for (let i = 0; i < 10; i++) {
      const prompt = this.ui.passwordPrompt();
      // Wait for the screen the last Next opened (a password prompt, or the Next / final button) before looking for the prompt.
      try {
        await prompt.or(this.ui.finishButton()).or(this.ui.nextButton()).first().waitFor({ timeout: 15_000 });
      } catch {
        break;
      }
      if (await prompt.isVisible()) {
        run.passwordPrompted = true;
        if (options.password !== undefined) {
          await prompt.click({ timeout: 10_000 });
          await prompt.press('Control+A');
          await prompt.pressSequentially(options.password, { delay: 40 });
          await prompt.press('Tab');
        }
      }
      const final = this.ui.finishButton();
      const next = this.ui.nextButton();
      try {
        await final.or(next).first().waitFor({ timeout: 15_000 });
      } catch {
        break;
      }
      if (await final.isVisible()) {
        if (options.submit) {
          await final.click({ timeout: 10_000 });
          run.submitted = true;
        }
        break;
      }
      await next.click({ timeout: 10_000 });
      await viewingPause();
      run.steps++;
    }
    run.passwordMessages = await this.passwordMessages();
    return run;
  }

  async passwordMessages(): Promise<string[]> {
    const loc = this.page.getByText(/password/i).filter({ visible: true }).filter({ hasNotText: /Set a password|Manage passwords|Select password|Create password/ });
    return (await loc.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  async cancelWizard(): Promise<void> {
    if (await this.ui.cancelButton().count()) await this.ui.cancelButton().click({ timeout: 10_000 });
  }

  // ---- Activities (Observed layout: Past Activities rows newest first with a Completed / Failed / Stopped badge) ----

  async openActivities(): Promise<void> {
    await this.page.goto(BkA7RecoverPage.activitiesRoute);
    await this.page.getByText('Past Activities', { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 30_000 });
  }

  // Text of the newest past activity whose row matches the pattern ('' when none), to tell a new row from an old one later.
  async newestActivityText(pattern: RegExp): Promise<string> {
    const rows = this.ui.pastActivityRows(pattern);
    if ((await rows.count()) === 0) return '';
    return (await rows.first().innerText()).replace(/\s+/g, ' ').trim();
  }

  // Waits (polling the open Activities page every 2 s) until the newest matching row differs from `before` and carries an end status.
  async waitActivity(pattern: RegExp, before: string, timeoutMs: number): Promise<{ outcome: ActivityOutcome; row: string }> {
    await this.openActivities();
    try {
      await this.page.waitForFunction(
        (arg) => {
          const rows = Array.from(document.querySelectorAll<HTMLElement>(".x-grid-row")).filter((r) => r.offsetParent !== null);
          const mine = rows.filter((r) => new RegExp(arg.pattern).test(r.innerText));
          if (mine.length === 0) return false;
          const text = mine[0].innerText.replace(/\s+/g, " ").trim();
          return text !== arg.before && /Completed|Failed|Stopped/.test(text);
        },
        { pattern: pattern.source, before },
        { timeout: timeoutMs, polling: 2_000 },
      );
    } catch {
      return { outcome: "timeout", row: await this.newestActivityText(pattern) };
    }
    const row = await this.newestActivityText(pattern);
    for (const status of ["Completed", "Failed", "Stopped"] as const) {
      if (row.includes(status)) return { outcome: status, row };
    }
    return { outcome: "timeout", row };
  }

  // ---- repository Backups list (UNVERIFIED navigation: Settings > Repositories > <repo>) ----

  // Text of the repository Backups row of a job ('' when not found).
  async repositoryBackupRowText(repoName: string, jobName: string): Promise<string> {
    await this.page.goto(BkA7RecoverPage.settingsRoute);
    await this.ui.settingsTab('Repositories').click({ timeout: 30_000 });
    await this.ui.repositoryEntry(repoName).click({ timeout: 15_000 });
    const row = this.ui.repositoryBackupRow(jobName);
    try {
      await row.waitFor({ timeout: 20_000 });
    } catch {
      return '';
    }
    return (await row.innerText()).replace(/\s+/g, ' ').trim();
  }
}
