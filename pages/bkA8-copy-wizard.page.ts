import type { Locator, Page } from '@playwright/test';
import { BackupWizardPage } from './backup-wizard.page';

// "Backup Copy Job" wizard for Microsoft SQL Server databases (Data Protection > + > Backup Copy Job) and the Repositories view used to
// read a copy target. UNVERIFIED: the Backup Copy wizard was never opened during the UI exploration (only these notes exist: the
// copy wizard Options show VM items, "Copy 1 latest recovery point only" is disabled, the default retention is "Synchronize recovery
// points and apply custom retention"). Every locator below is text-based and inferred from the case folders (Source, Destination, Schedule,
// Retention, Options) and from the Backup-for-Database wizard; the first live run must correct them.
// Page object rules: locators and one-action methods only; no assertions, no .env, no waits other than a locator's own.

export type CopyStep = 'Source' | 'Destination' | 'Schedule' | 'Retention' | 'Options';
export const COPY_STEPS: CopyStep[] = ['Source', 'Destination', 'Schedule', 'Retention', 'Options'];

export class CopyWizardPage {
  /** The shared Backup-for-Database wizard page: buttons, source tree, boundlist items are reused as they are. */
  readonly base: BackupWizardPage;
  // UNVERIFIED: title text inferred from "New Backup Job Wizard for Database"
  readonly title: Locator;
  readonly sourceSearch: Locator;
  readonly selectionSummary: Locator;
  // Step 3 / 4 (UNVERIFIED)
  readonly onDemandCheckbox: Locator;
  readonly maintainExactCopy: Locator;
  readonly gfsToggle: Locator;
  readonly immutableToggle: Locator;
  readonly immutableForField: Locator;
  // Step 5 (UNVERIFIED)
  readonly jobNameField: Locator;
  readonly transporterLoadCheckbox: Locator;
  readonly transporterLoadField: Locator;
  readonly bottleneckCheckbox: Locator;
  readonly passwordDialog: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.base = new BackupWizardPage(page);
    // UNVERIFIED: locator inferred from the Backup-for-Database wizard title, not seen live
    this.title = page.getByText(/Backup Copy Job Wizard|Backup Copy Job|Edit: /).filter({ visible: true }).first();
    this.sourceSearch = this.base.sourceSearch;
    this.selectionSummary = this.base.selectionSummary;
    this.onDemandCheckbox = this.base.onDemandCheckbox;
    this.maintainExactCopy = page.locator('label:visible', { hasText: 'Maintain exact copy of the source backup' }).first();
    this.gfsToggle = page.locator('label:visible', { hasText: /GFS|Grandfather/i }).first();
    this.immutableToggle = page.locator('label:visible', { hasText: /Make recovery points immutable/i }).first();
    this.immutableForField = page.getByText(/Immutable for|Make recovery points immutable for/i).filter({ visible: true }).first().locator('xpath=following::input[1]');
    this.jobNameField = page.getByText('Job name:', { exact: false }).locator('xpath=following::input[1]');
    this.transporterLoadCheckbox = page.locator('label:visible', { hasText: /Limit transporter load/i }).first();
    this.transporterLoadField = page
      .getByText(/Limit transporter load/i)
      .filter({ visible: true })
      .first()
      .locator("xpath=following::input[not(@type='checkbox')][1]");
    this.bottleneckCheckbox = page.locator('label:visible', { hasText: 'Bottleneck detection' }).first();
    this.passwordDialog = page.locator('.x-window:visible').filter({ hasText: /Set a password|Create password|Select password/ }).last();
  }

  // The "Backup Copy Job" entry of the + menu. UNVERIFIED: the case text says "Create > Backup copy job for Microsoft SQL Server",
  // so a second level (or a dialog) naming Microsoft SQL Server may follow; see CopyFlows.openWizard.
  get addMenuCopyItem(): Locator {
    return this.page.getByText('Backup Copy Job', { exact: true }).filter({ visible: true }).first();
  }

  get sqlServerChoice(): Locator {
    return this.page.getByText(/Microsoft SQL Server|for Database/).filter({ visible: true }).first();
  }

  // Step header tab (clickable); count() tells whether the wizard has that step at all.
  stepTab(step: CopyStep): Locator {
    return this.page.getByText(step, { exact: true }).filter({ visible: true });
  }

  treeRow(name: string): Locator {
    return this.base.treeRow(name);
  }

  // Combo input of an Options / Retention / Schedule field by its caption.
  fieldByLabel(label: string | RegExp): Locator {
    return this.page.getByText(label).filter({ visible: true }).first().locator('xpath=following::input[1]');
  }

  checkboxByLabel(label: string | RegExp): Locator {
    return this.page.locator('label:visible', { hasText: label }).first();
  }

  boundListItems(): Locator {
    return this.page.locator('.x-boundlist-item:visible');
  }

  boundListItem(text: string): Locator {
    return this.base.boundListItem(text);
  }

  // Destination entry: the popup is a div/grid list, so the exact text is searched anywhere (last = the popup, not the combo value).
  destinationEntry(name: string): Locator {
    return this.page.getByText(name, { exact: false }).filter({ visible: true }).last();
  }

  // Immutability-related and mode texts
  textLike(pattern: string | RegExp): Locator {
    return this.page.getByText(pattern).filter({ visible: true }).first();
  }

  // Retention count field. UNVERIFIED: guessed as the number field after a "Keep ... recovery points" / "Retain" caption.
  retentionCountField(): Locator {
    return this.page
      .getByText(/^(Keep|Retain)\b/i)
      .filter({ visible: true })
      .first()
      .locator("xpath=following::input[not(@type='checkbox')][1]");
  }

  gfsField(period: 'weekly' | 'monthly' | 'yearly'): Locator {
    return this.page
      .getByText(new RegExp(period, 'i'))
      .filter({ visible: true })
      .first()
      .locator("xpath=following::input[not(@type='checkbox')][1]");
  }
}

// Repositories view (Settings > Repositories). UNVERIFIED: route and captions inferred from the Overview counters and the case text
// "open Configuration > Repositories".
export class RepositoriesViewPage {
  static readonly route = '/c/configuration';
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto(RepositoriesViewPage.route);
  }

  get repositoriesTab(): Locator {
    return this.page.getByText('Repositories', { exact: true }).filter({ visible: true }).first();
  }

  repositoryRow(name: string): Locator {
    return this.page.getByText(name, { exact: true }).filter({ visible: true }).first();
  }

  // The panel that lists backups / recovery points of the open repository (any text; the flow reads its visible leaf texts).
  get backupsTab(): Locator {
    return this.page.getByText(/^Backups?$|Recovery points/i).filter({ visible: true }).first();
  }
}
