import type { Locator, Page } from '@playwright/test';

// "New Backup Job Wizard for Database" (Data Protection > + > Backup for Database) and its Edit twin ("Edit: <job>").
// Locator facts come from the owner-approved UI exploration on Director 11.2.1.112232 on 2026-10-07/08 (knowledge/workflows/backup/
// backup-job-wizard.md; the memory notes nakivo-db-backup-job-wizard, nakivo-db-backup-automation-plan and
// nakivo-db-backup-job-management). They have NOT been re-checked in this session: no case that uses this page has been run yet, so a
// locator that does not match is the first thing to correct after the first real run.
//
// Wizard in 11.2.1: 4 steps (Source, Destination, Schedule, Options). Retention is inline in Schedule ("Keep backups for"), and the
// streams / bottleneck / scripts controls sit in Options. The specification describes up to 7 steps; the UI is the baseline.
//
// Page object rules (standards/): locators and one-action methods only; no assertions, no .env, no waits other than a locator's own.

export type WizardStep = 'Source' | 'Destination' | 'Schedule' | 'Options';
export type ScheduleType = 'Weekly' | 'Monthly' | 'Yearly' | 'Periodic' | 'After another job';
export type SqlBackupType = 'Full' | 'Differential' | 'Log';

export class BackupWizardPage {
  static readonly route = '/c/main';

  readonly title: Locator;
  readonly nextButton: Locator;
  readonly finishButton: Locator;
  readonly finishAndRunButton: Locator;
  readonly saveButton: Locator;
  readonly saveAndRunButton: Locator;
  readonly cancelButton: Locator;
  // Step 1
  readonly sourceSearch: Locator;
  readonly selectionSummary: Locator;
  // Step 2
  readonly destinationCombo: Locator;
  readonly advancedSetupLink: Locator;
  // Step 3
  readonly onDemandCheckbox: Locator;
  readonly prioritizeSchedulesCheckbox: Locator;
  readonly addScheduleLink: Locator;
  // Step 4
  readonly jobNameField: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByText(/Backup Job Wizard for Database|^Edit: /).filter({ visible: true }).first();
    this.nextButton = page.getByText('Next', { exact: true }).filter({ visible: true });
    this.finishButton = page.getByText('Finish', { exact: true }).filter({ visible: true });
    this.finishAndRunButton = page.getByText('Finish & Run', { exact: true }).filter({ visible: true });
    this.saveButton = page.getByText('Save', { exact: true }).filter({ visible: true });
    this.saveAndRunButton = page.getByText('Save & Run', { exact: true }).filter({ visible: true });
    this.cancelButton = page.getByText('Cancel', { exact: true }).filter({ visible: true });
    this.sourceSearch = page.locator('input[placeholder*="Search" i]:visible').first();
    this.selectionSummary = page.getByText(/item\(s\) were added to this job|Select at least one item on the left/).filter({ visible: true }).first();
    this.destinationCombo = page.getByText('Destination:', { exact: false }).locator('xpath=following::input[1]');
    this.advancedSetupLink = page.getByText('Advanced setup', { exact: false }).filter({ visible: true }).first();
    this.onDemandCheckbox = page.locator('label:visible', { hasText: 'Do not schedule, run on demand' });
    this.prioritizeSchedulesCheckbox = page.locator('label:visible', { hasText: 'Prioritize schedules' });
    this.addScheduleLink = page.getByText('Add another schedule', { exact: false }).filter({ visible: true }).first();
    this.jobNameField = page.getByText('Job name:', { exact: false }).locator('xpath=following::input[1]');
  }

  // The step header tab; the tabs are clickable (Edit wizard, and the Add wizard once a step was reached).
  stepTab(step: WizardStep): Locator {
    return this.page.getByText(step, { exact: true }).filter({ visible: true }).first();
  }

  // ---- Step 1: Source tree ----

  // A row of the inventory tree (an item, an AG, or a database) by its exact text.
  treeRow(name: string): Locator {
    return this.page.locator('.x-grid-row, .x-tree-node-text, .x-grid-cell').filter({ hasText: new RegExp(`^${escapeRegex(name)}$`) }).filter({ visible: true }).first();
  }

  // The checkbox of a tree row. When the same database name sits under several items, `index` selects the n-th match.
  treeCheckbox(name: string, index = 0): Locator {
    return this.page
      .locator(`xpath=//*[contains(@class,'x-grid-row') or contains(@class,'x-tree-node')][.//*[normalize-space(text())=${xpathLiteral(name)}]]//*[contains(@class,'checkbox')]`)
      .filter({ visible: true })
      .nth(index);
  }

  // ---- Step 2: Destination ----

  // An option of the destination list (the list is a grid/div popup, not a boundlist; it closes when focus leaves).
  destinationOption(repoName: string): Locator {
    return this.page.getByText(repoName, { exact: false }).filter({ visible: true }).last();
  }

  // ---- Step 3: Schedule ----

  scheduleField(name: 'scheduleName' | 'type' | 'everyWeeks' | 'time1' | 'time2' | 'customKeepSavepointCount'): Locator {
    return this.page.locator(`input[name="${name}"]:visible`).first();
  }

  // The "SQL backup type" combo of a schedule has only a generated name; it is the combo labelled "SQL backup type".
  sqlBackupTypeField(): Locator {
    return this.page.getByText('SQL backup type', { exact: false }).filter({ visible: true }).first().locator('xpath=following::input[1]');
  }

  boundListItem(text: string): Locator {
    return this.page.locator('.x-boundlist-item:visible').filter({ hasText: new RegExp(`^${escapeRegex(text)}$`) }).first();
  }

  // ---- Step 4: Options ----

  optionCheckbox(label: string): Locator {
    return this.page.locator('label:visible', { hasText: label }).first();
  }

  optionInput(label: string): Locator {
    return this.page.getByText(label, { exact: false }).filter({ visible: true }).first().locator('xpath=following::input[1]');
  }

  concurrentStreamsField(): Locator {
    return this.page.locator('input[name="mssqlDataBackupConcurrentStreams"]:visible').first();
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function xpathLiteral(text: string): string {
  return text.includes("'") ? `concat('${text.replace(/'/g, "',\"'\",'")}')` : `'${text}'`;
}
