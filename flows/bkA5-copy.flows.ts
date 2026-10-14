import type { Page } from '@playwright/test';
import { BackupFlows } from './backup.flows';
import type { JobOutcome } from './backup.flows';

// The Backup Copy Job wizard, driven only by visible text. NOTHING in this file was seen live: the Backup Copy wizard was never opened in
// the UI exploration (brief, 2026-10-12), so every locator is a guess from the Backup-for-Database wizard and is flagged UNVERIFIED.
// Expected shape (inferred): Data Protection > + > "Backup Copy Job" > Source (tick the backup job) > Destination (repository) >
// Schedule (run on demand) > Options (job name) > Finish & Run > "Run this job?" > Run.
// Same rules as every flows file: no assertions, no .env, no fixed sleeps.

export class BkA5CopyFlows {
  readonly backup: BackupFlows;

  private readonly page: Page;

  constructor(page: Page, backup: BackupFlows) {
    this.page = page;
    this.backup = backup;
  }

  // UNVERIFIED: menu item text "Backup Copy Job" (seen in the + menu list of the notes), source tick by the job's name in the tree.
  async createAndRunCopyJob(copyJobName: string, sourceJobName: string, repo: string, timeoutMs = 300_000): Promise<JobOutcome> {
    await this.backup.gotoJobs();
    await this.backup.jobs.addButton.click({ timeout: 10_000 });
    await this.page.getByText('Backup Copy Job', { exact: true }).filter({ visible: true }).first().click({ timeout: 10_000 });
    await this.page.getByText(/Backup Copy Job Wizard|Copy Job/).filter({ visible: true }).first().waitFor({ timeout: 30_000 });

    // UNVERIFIED: the source job row has a checkbox before its name.
    const sourceBox = this.page.locator(`xpath=(//*[normalize-space(text())=${literal(sourceJobName)}])[1]/preceding::*[contains(@class,"checkbox")][1]`);
    await sourceBox.click({ timeout: 15_000 });
    await this.backup.next();

    let destinationDone = false;
    let scheduleDone = false;
    for (let step = 0; step < 6; step++) {
      // Wait for the screen that Next opened (any of the three it can be) before deciding which one it is.
      await this.backup.wizard.jobNameField
        .or(this.page.getByText('Destination:', { exact: false }).filter({ visible: true }))
        .or(this.backup.wizard.onDemandCheckbox)
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 });
      if (await this.backup.wizard.jobNameField.isVisible()) break;
      if (!destinationDone && (await this.page.getByText('Destination:', { exact: false }).filter({ visible: true }).count()) > 0) {
        await this.backup.chooseDestination(repo);
        destinationDone = true;
      } else if (!scheduleDone && (await this.backup.wizard.onDemandCheckbox.count()) > 0) {
        await this.backup.setOnDemand();
        scheduleDone = true;
      }
      await this.backup.next();
    }
    await this.backup.setJobName(copyJobName);
    await this.backup.wizard.finishAndRunButton.click({ timeout: 10_000 });
    await this.backup.jobs.runDialog.waitFor({ timeout: 15_000 });
    await this.backup.jobs.runDialogRunButton.click({ timeout: 10_000 });
    try {
      await this.page.getByText(/Running \(/).filter({ visible: true }).first().waitFor({ timeout: 20_000 });
    } catch {
      // A very short run never shows "Running (".
    }
    return this.backup.waitForResult(timeoutMs);
  }
}

function literal(text: string): string {
  return text.includes("'") ? `concat('${text.replace(/'/g, "',\"'\",'")}')` : `'${text}'`;
}
