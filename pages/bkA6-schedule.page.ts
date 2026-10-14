import type { Locator, Page } from '@playwright/test';

// Step 3 (Schedule) of the "Backup for Database" wizard, per schedule block ("Schedule #1", "Schedule #2", ...), for the Step 3 cases (agent A6).
// Facts: owner-approved exploration on Director 11.2.1.112232 (memory notes nakivo-db-backup-job-wizard and nakivo-db-backup-job-management;
// knowledge/workflows/backup/backup-job-wizard.md). The schedule is INLINE in the wizard: there is no Create-schedule dialog and no Schedule card.
// Named inputs seen: scheduleName, type, everyWeeks, time1, time2, customKeepSavepointCount. Everything marked UNVERIFIED was inferred from the
// notes (labels, info-icon class qmMain) and was not seen live: correct it first after the first real run.
// Page object rules: locators only; no assertions, no .env, no waits.

export class BkA6SchedulePage {
  readonly onDemandCheckbox: Locator;
  readonly prioritizeLabel: Locator;
  readonly prioritizeInfoIcon: Locator;
  readonly addScheduleLink: Locator;
  readonly showCalendarLink: Locator;
  readonly hideCalendarLink: Locator;
  readonly timeZoneLabel: Locator;
  readonly closePrompt: Locator;
  readonly closePromptButton: Locator;
  readonly selfBackupWarning: Locator;
  readonly selfBackupProceed: Locator;
  readonly datePicker: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.onDemandCheckbox = page.locator('label:visible', { hasText: 'Do not schedule, run on demand' });
    this.prioritizeLabel = page.locator('label:visible', { hasText: 'Prioritize schedules' });
    // UNVERIFIED: the info icon is the first element with class qmMain after the label (notes: "div.qmMain info icons").
    this.prioritizeInfoIcon = this.prioritizeLabel.locator('xpath=following::*[contains(@class,"qmMain")][1]');
    this.addScheduleLink = page.getByText('Add another schedule', { exact: false }).filter({ visible: true }).first();
    this.showCalendarLink = page.getByText('Show calendar', { exact: true }).filter({ visible: true }).first();
    this.hideCalendarLink = page.getByText('Hide calendar', { exact: true }).filter({ visible: true }).first();
    this.timeZoneLabel = page.getByText('Time zone', { exact: false }).filter({ visible: true }).first();
    this.closePrompt = page.getByText('Close the wizard?', { exact: false }).filter({ visible: true }).first();
    this.closePromptButton = page.locator('.x-window:visible').filter({ hasText: 'Close the wizard?' }).last().getByText('Close', { exact: true });
    this.selfBackupWarning = page.getByText('Running a self-backup simultaneously', { exact: false }).filter({ visible: true }).first();
    this.selfBackupProceed = page.locator('.x-window:visible').filter({ hasText: 'self-backup' }).last().getByText('Proceed', { exact: true });
    // UNVERIFIED: the "Effective from" picker window is found by its caption "The job schedule will come into effect on the selected date".
    this.datePicker = page.locator(
      'xpath=//*[contains(normalize-space(text()),"come into effect on the selected date")]/ancestor::*[contains(@class,"x-window") or contains(@class,"x-panel") or contains(@class,"x-menu") or contains(@class,"x-datepicker")][1]',
    );
  }

  // The header "Schedule #n" (n = index + 1).
  header(index: number): Locator {
    return this.page.locator(`xpath=(//*[not(*)][starts-with(normalize-space(.),'Schedule #${index + 1}')])[1]`).filter({ visible: true });
  }

  // The block of one schedule: the highest ancestor of its header that holds exactly one Type input.
  block(index: number): Locator {
    return this.page.locator(
      `xpath=(//*[not(*)][starts-with(normalize-space(.),'Schedule #${index + 1}')])[1]/ancestor::*[count(.//input[@name='type'])=1][last()]`,
    );
  }

  typeInput(index: number): Locator {
    return this.block(index).locator('input[name="type"]:visible').first();
  }

  nameInput(index: number): Locator {
    return this.block(index).locator('input[name="scheduleName"]:visible').first();
  }

  everyWeeksInput(index: number): Locator {
    return this.block(index).locator('input[name="everyWeeks"]:visible').first();
  }

  startAtInput(index: number): Locator {
    return this.block(index).locator('input[name="time1"]:visible').first();
  }

  endAtInput(index: number): Locator {
    return this.block(index).locator('input[name="time2"]:visible').first();
  }

  // UNVERIFIED: the "end at" checkbox is a label containing "end at".
  endAtCheckbox(index: number): Locator {
    return this.block(index).locator('label:visible', { hasText: /end at/i }).first();
  }

  keepCountInput(index: number): Locator {
    return this.block(index).locator('input[name="customKeepSavepointCount"]:visible').first();
  }

  keepUnitInput(index: number): Locator {
    return this.keepCountInput(index).locator('xpath=following::input[1]');
  }

  keepInfoIcon(index: number): Locator {
    return this.keepCountInput(index).locator('xpath=following::*[contains(@class,"qmMain")][1]');
  }

  // Periodic: "Run every <N> <minutes|hours|days>". UNVERIFIED: inputs are the first two inputs after the "Run every" label.
  runEveryInput(index: number): Locator {
    return this.block(index).getByText('Run every', { exact: false }).filter({ visible: true }).first().locator('xpath=following::input[1]');
  }

  runEveryUnitInput(index: number): Locator {
    return this.block(index).getByText('Run every', { exact: false }).filter({ visible: true }).first().locator('xpath=following::input[2]');
  }

  allDaysLink(index: number): Locator {
    return this.block(index).getByText('All days', { exact: true }).filter({ visible: true }).first();
  }

  // UNVERIFIED: a weekday checkbox is a label starting with the day abbreviation (Mon, Tue, ...).
  dayLabel(index: number, day: string): Locator {
    return this.block(index).locator('label:visible').filter({ hasText: new RegExp(`^${day}`) }).first();
  }

  // After another job: "Parent job" combo (a grid/div popup, not a boundlist).
  parentJobInput(index: number): Locator {
    return this.block(index).getByText('Parent job', { exact: false }).filter({ visible: true }).first().locator('xpath=following::input[1]');
  }

  // "Effective from" shows a link ("date" before a date is chosen). UNVERIFIED: the first link/anchor after the label.
  effectiveFromLabel(index: number): Locator {
    return this.block(index).getByText('Effective from', { exact: false }).filter({ visible: true }).first();
  }

  effectiveFromLink(index: number): Locator {
    return this.effectiveFromLabel(index).locator('xpath=following::*[self::a or contains(@class,"link")][1]');
  }

  // The SQL backup type combo of a schedule (only a generated name) and its info icon.
  sqlTypeLabel(index: number): Locator {
    return this.block(index).getByText('SQL backup type', { exact: false }).filter({ visible: true }).first();
  }

  sqlTypeInput(index: number): Locator {
    return this.sqlTypeLabel(index).locator('xpath=following::input[1]');
  }

  // UNVERIFIED: the info icon is the first qmMain element after the combo input (the notes say the tooltip was seen once and missing once).
  sqlTypeInfoIcon(index: number): Locator {
    return this.sqlTypeInput(index).locator('xpath=following::*[contains(@class,"qmMain")][1]');
  }

  // UNVERIFIED: the immutability control is found by its text (the cases call it "Immutable for:" / immutability period); not seen in the notes.
  immutableLabel(index: number): Locator {
    return this.block(index).getByText(/immutab/i).filter({ visible: true }).first();
  }

  immutableCheckbox(index: number): Locator {
    return this.block(index).locator('label:visible', { hasText: /immutab/i }).first();
  }

  immutableDaysInput(index: number): Locator {
    return this.immutableLabel(index).locator('xpath=following::input[not(@type="checkbox")][1]');
  }

  removeLink(index: number): Locator {
    return this.block(index).getByText('Remove', { exact: true }).filter({ visible: true }).first();
  }

  boundItem(text: string): Locator {
    return this.page.locator('.x-boundlist-item:visible').filter({ hasText: new RegExp(`^${escapeRegex(text)}$`, 'i') }).first();
  }

  boundItems(): Locator {
    return this.page.locator('.x-boundlist-item:visible');
  }

  // The job page: the Edit button, the Manage menu items used by cleanup.
  editButton(): Locator {
    return this.page.getByText('Edit', { exact: true }).filter({ visible: true }).first();
  }

  // ---- Settings > Repositories (immutable cases), UNVERIFIED: tab and row texts inferred from the notes ----
  repositoriesTab(): Locator {
    return this.page.getByText('Repositories', { exact: true }).filter({ visible: true }).first();
  }

  repositoryRow(name: string): Locator {
    return this.page.getByText(name, { exact: true }).filter({ visible: true }).first();
  }

  backupRow(jobName: string): Locator {
    return this.page.locator('.x-grid-row:visible').filter({ hasText: jobName }).first();
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
