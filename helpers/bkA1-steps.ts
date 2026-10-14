import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';
import { InventoryFlows } from '../flows/inventory.flows';
import type { BackupFlows } from '../flows/backup.flows';
import { BkA1ChainFlows, type PeriodicSchedule } from '../flows/bkA1-chain.flows';
import type { SqlBackupType } from '../pages/backup-wizard.page';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor, type BackupSource, type RepoRole, type SourceKind } from './backup-env';
import { checkName, type BackupHistoryRow, type RecoveryModel, type SqlBackupHost } from './sql-host';

// Spec-layer step library of the backup-type and backup-execution cases (assignment A1). The specs keep one test.step per Xray step
// (same numbering) and call one method here per step; the expect() calls live here, not in flows/ or pages/ (standards/flows-layer.md).
// It reads .env only through helpers/backup-env.ts. A value that is missing there ends the test ABORTED ("Missing in .env ...").
// Evidence of what NBR stored: SQL Server's own msdb history (SqlBackupHost.backupHistory). NBR backs up through a virtual device
// (device_type 7) and records type D (full), I (differential), L (log); a native backup goes to disk (device_type 2).
// NOT yet run against a live Director: every UI locator comes from the shared pages and the notes (see flows/bkA1-chain.flows.ts).

const NBR_DEVICE = '7';
const TABLE = 'qa_bk_changes';

export type HistoryType = 'D' | 'I' | 'L';
export const TYPE_CODE: Record<SqlBackupType, HistoryType> = { Full: 'D', Differential: 'I', Log: 'L' };

// NBR's backups only, one entry per backup (a multi-stream backup has one row per device), oldest first.
export function nbrBackups(rows: BackupHistoryRow[]): BackupHistoryRow[] {
  const seen = new Set<string>();
  const kept: BackupHistoryRow[] = [];
  for (const row of rows) {
    if (row.deviceType !== NBR_DEVICE) continue;
    const key = `${row.type}|${row.finishedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
  }
  return kept.sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
}

export function freshSince(before: BackupHistoryRow[], after: BackupHistoryRow[]): BackupHistoryRow[] {
  const known = new Set(before.map((row) => `${row.type}|${row.finishedAt}`));
  return after.filter((row) => !known.has(`${row.type}|${row.finishedAt}`));
}

export interface KitOptions {
  key: string;
  kind: SourceKind;
  model: RecoveryModel;
  /** Repository role in .env (NAKIVO_BK_REPO_<ROLE>). Default PRIMARY. */
  repoRole?: RepoRole;
}

export interface KitDeps {
  page: Page;
  backupFlows: BackupFlows;
  testInfo: TestInfo;
}

export class BkKit {
  readonly key: string;
  readonly jobName: string;
  readonly flows: BkA1ChainFlows;

  private readonly options: KitOptions;
  private readonly deps: KitDeps;
  private inventory!: InventoryFlows;
  private source!: BackupSource;
  private host!: SqlBackupHost;
  private db = '';
  private repo = '';
  private originalModel = '';
  private jobCreated = false;
  private tableCreated = false;
  private scheduled = false;
  private baseline: BackupHistoryRow[] = [];
  private beforeRun: BackupHistoryRow[] = [];
  private externalCount = 0;

  constructor(options: KitOptions, deps: KitDeps) {
    this.options = options;
    this.deps = deps;
    this.key = options.key;
    this.jobName = backupJobName(options.key);
    this.flows = new BkA1ChainFlows(deps.page, deps.backupFlows);
  }

  note(type: string, description: string): void {
    this.deps.testInfo.annotations.push({ type, description });
  }

  // The case-vs-ui facts every case of this assignment shares.
  commonCaseVsUi(): void {
    this.note('case-vs-ui', 'Create > Microsoft SQL Server backup job / Databases step = Data Protection > + > Backup for Database / Source step (4 steps: Source, Destination, Schedule, Options)');
    this.note('case-vs-ui', 'Recovery points are checked in msdb.backupset (type D / I / L written by NBR through a virtual device); the Recover picker is only tried and attached as evidence');
  }

  // ---- precondition steps ----

  // Reads the lab values, makes sure the Inventory item is listed. Ends ABORTED when a value is missing or the item is not in Inventory.
  async checkInventory(): Promise<void> {
    this.source = readBackupSource(this.options.kind);
    this.db = readBackupDatabase(this.options.kind, this.options.model);
    this.repo = readBackupRepo(this.options.repoRole ?? 'PRIMARY');
    this.host = sqlHostFor(this.source);
    if ((this.options.kind === 'AG' || this.options.kind === 'READSCALE') && this.options.model !== 'FULL') {
      throw new Error('ABORTED: SQL Server refuses the SIMPLE and BULK_LOGGED recovery models on an availability group database (Msg 1468), so this combination cannot be set up');
    }
    checkName(this.db);
    this.inventory = new InventoryFlows(this.deps.page);
    await this.inventory.gotoInventory();
    if (!(await this.inventory.hasItem(this.source.item))) {
      throw new Error(`ABORTED: the Inventory item "${this.source.item}" (NAKIVO_BK_${this.options.kind}_ITEM) is not listed in Settings > Inventory`);
    }
  }

  // The repository is an existing lab object named in .env; it is proven selectable (and therefore Online) at the Destination step.
  checkRepositoryNamed(): void {
    expect(this.repo, `NAKIVO_BK_REPO_${this.options.repoRole ?? 'PRIMARY'} is empty`).not.toBe('');
    this.note('observed-outcome', 'Repository Online state is proven by the destination list offering it (Destination step); no repository page is driven');
  }

  // Sets the recovery model the case needs (remembers the old one for cleanup) and proves it with sys.databases.
  async setRecoveryModel(): Promise<void> {
    this.originalModel = await this.host.recoveryModel(this.db);
    if (!this.originalModel) throw new Error(`ABORTED: database ${this.db} was not found on ${this.source.host}`);
    if (this.originalModel !== this.options.model) {
      try {
        await this.host.setRecoveryModel(this.db, this.options.model);
      } catch (error) {
        throw new Error(`ABORTED: could not set ${this.options.model} recovery on ${this.db}: ${(error as Error).message}`);
      }
    }
    expect(await this.host.recoveryModel(this.db), `${this.db} is not in ${this.options.model} recovery`).toBe(this.options.model);
    this.baseline = nbrBackups(await this.host.backupHistory(this.db, 50));
  }

  // The database must have had a database backup at some time before a native LOG backup works (SQL Server rule). Adds a native Full only if none exists.
  async ensureSomeFullExists(): Promise<void> {
    const rows = await this.host.backupHistory(this.db, 50);
    if (!rows.some((row) => row.type === 'D')) {
      await this.host.nativeBackup(this.db, 'FULL', this.externalName('Seed'));
      this.note('observed-outcome', `No earlier full backup existed in msdb for ${this.db}; a native Full was taken first so an external Log backup is possible`);
    }
    this.baseline = nbrBackups(await this.host.backupHistory(this.db, 50));
  }

  // ---- wizard steps ----

  async openWizardOnSource(): Promise<void> {
    await this.deps.backupFlows.openWizard();
    await expect(this.deps.backupFlows.wizard.title).toBeVisible();
    await expect(this.deps.backupFlows.wizard.selectionSummary).toContainText('Select at least one item');
  }

  async selectDatabase(): Promise<void> {
    await this.deps.backupFlows.selectSources([{ item: this.source.item, databases: [this.db] }]);
    await expect(this.deps.backupFlows.wizard.selectionSummary).toContainText('item(s) were added to this job');
  }

  // Ad hoc (negative): with nothing ticked the wizard asks for a source and Next does not leave the step.
  async nextIsBlockedWithoutSource(): Promise<void> {
    const wizard = this.deps.backupFlows.wizard;
    await expect(wizard.selectionSummary).toContainText('Select at least one item');
    await this.deps.backupFlows.next({ blocked: true });
    await expect(wizard.selectionSummary).toBeVisible();
    await expect(wizard.destinationCombo).toBeHidden();
  }

  async chooseRepository(): Promise<void> {
    await this.deps.backupFlows.next();
    await this.deps.backupFlows.chooseDestination(this.repo);
    await expect(this.deps.backupFlows.wizard.destinationCombo).toHaveValue(new RegExp(escapeRegex(this.repo)));
  }

  // Schedule step: on demand. Options step: job name. Leaves the wizard on its last step.
  async fillOnDemandAndName(): Promise<void> {
    const flows = this.deps.backupFlows;
    await flows.next();
    await flows.setOnDemand();
    await flows.next();
    await flows.setJobName(this.jobName);
    await expect(flows.wizard.jobNameField).toHaveValue(this.jobName);
  }

  // Finish only: the job exists, has never run and is on demand (its schedule is added later through Edit).
  async finishWithoutRun(): Promise<void> {
    this.jobCreated = true;
    await this.deps.backupFlows.wizard.finishButton.click({ timeout: 10_000 });
    await expect(this.deps.backupFlows.jobs.statusLine).toContainText('has not been executed yet', { timeout: 30_000 });
  }

  // Finish & Run: the first run of a new job is Full (the Run dialog offers no SQL backup type yet). Asserts that the run shows as Running.
  async finishAndRunFirstFull(): Promise<void> {
    this.beforeRun = nbrBackups(await this.host.backupHistory(this.db, 50));
    this.jobCreated = true;
    await this.flows.finishAndRun();
    expect(await this.flows.waitForRunning(30_000), 'the Full backup did not show "Running (" on the job page').toBe(true);
  }

  // ---- running ----

  // Opens the job and runs it as the given SQL backup type through the Run dialog. Asserts that it shows as Running.
  async runAs(type: SqlBackupType): Promise<void> {
    await this.deps.backupFlows.openJob(this.jobName);
    this.beforeRun = nbrBackups(await this.host.backupHistory(this.db, 50));
    const started = await this.flows.startRun(type);
    if (started.typeChoiceShown) expect(started.typeValue, 'the Run dialog did not take the chosen SQL backup type').toContain(type);
    expect(await this.flows.waitForRunning(30_000), `the ${type} backup did not show "Running (" on the job page`).toBe(true);
  }

  // Waits for the open job's run to end and expects "Last run was successful".
  async waitSuccess(timeoutMs = 600_000): Promise<void> {
    const outcome = await this.deps.backupFlows.waitForResult(timeoutMs);
    expect(outcome, `the job did not finish "Last run was successful" (got ${outcome}): ${await this.deps.backupFlows.readStatusLine().catch(() => '')}`).toBe('successful');
    expect(await this.flows.pageText()).not.toMatch(/Last run has failed/);
  }

  // The run ended with the given outcome (any of them), for the case that tolerates a warning.
  async waitFinished(timeoutMs = 600_000): Promise<string> {
    const outcome = await this.deps.backupFlows.waitForResult(timeoutMs);
    expect(['successful', 'warning'], `the job ended ${outcome}`).toContain(outcome);
    return outcome;
  }

  // ---- source changes ----

  async changeData(): Promise<void> {
    const db = checkName(this.db);
    await this.host.exec(`IF OBJECT_ID(N'[${db}].dbo.${TABLE}') IS NULL CREATE TABLE [${db}].dbo.${TABLE} (id int IDENTITY PRIMARY KEY, note nvarchar(100) NOT NULL, at datetime2 NOT NULL DEFAULT SYSDATETIME())`);
    this.tableCreated = true;
    await this.host.exec(`INSERT INTO [${db}].dbo.${TABLE} (note) SELECT TOP (500) N'${this.key}' FROM sys.all_objects a CROSS JOIN sys.all_columns b`);
    const rows = await this.host.query(`SELECT COUNT(*) FROM [${db}].dbo.${TABLE}`);
    expect(Number(rows[0][0]), 'no rows were added to generate changes').toBeGreaterThan(0);
  }

  private externalName(prefix: string): string {
    this.externalCount += 1;
    return `${this.key.replace('-', '_')}_${prefix}${this.externalCount}`;
  }

  // An external (native, outside NBR) backup issued on the SQL Server. Returns whether the NBR job was still Running when it finished.
  async externalBackup(kind: 'FULL' | 'LOG'): Promise<boolean> {
    await this.host.nativeBackup(this.db, kind, this.externalName(kind === 'FULL' ? 'Full' : 'Log'));
    const stillRunning = await this.flows.isRunning();
    const rows = await this.host.backupHistory(this.db, 5);
    expect(rows.some((row) => row.deviceType !== NBR_DEVICE && row.type === (kind === 'FULL' ? 'D' : 'L')), `msdb does not list the external ${kind} backup`).toBe(true);
    return stillRunning;
  }

  // ---- checks on what was stored ----

  async freshBackups(): Promise<BackupHistoryRow[]> {
    return freshSince(this.beforeRun, nbrBackups(await this.host.backupHistory(this.db, 50)));
  }

  // Exactly the given recovery points appeared since the run started (types in order), each linked to an earlier Full of the chain.
  async expectNewRecoveryPoints(types: HistoryType[], attach = true): Promise<void> {
    await expect.poll(async () => (await this.freshBackups()).map((row) => row.type), { message: 'recovery points since the run started', timeout: 60_000 }).toEqual(types);
    const all = nbrBackups(await this.host.backupHistory(this.db, 50));
    const fresh = await this.freshBackups();
    if (types[0] !== 'D') {
      const older = all.filter((row) => row.finishedAt < fresh[0].finishedAt);
      expect(older.some((row) => row.type === 'D'), 'the new recovery point has no earlier Full recovery point to link to').toBe(true);
    }
    if (attach) await this.attachRecoveryPointList();
  }

  // The Recover picker is tried (UNVERIFIED locators); what it shows, or that it could not be reached, goes to the report only.
  async attachRecoveryPointList(): Promise<void> {
    const rows = await this.flows.tryReadRecoveryPoints(this.jobName, this.db);
    this.note('observed-outcome', rows ? `Recover picker rows for ${this.db}: ${rows.slice(0, 8).join(' | ')}` : 'Recover picker could not be reached with the text-based locators; msdb history was the evidence');
  }

  // "No alarm": the job page shows no failure text and the database is ONLINE in the model the case set.
  async expectNoFailureAndHealthyDatabase(): Promise<void> {
    await this.deps.backupFlows.openJob(this.jobName);
    expect(await this.flows.pageText()).not.toMatch(/Last run has failed|has failed/i);
    const identity = await this.host.identity(this.db);
    expect(identity?.state, `${this.db} is not ONLINE`).toBe('ONLINE');
    expect(await this.host.recoveryModel(this.db)).toBe(this.options.model);
  }

  // The chain-break warning (sql4) after an external backup; returns the matching line or ''.
  async chainBreakWarning(): Promise<string> {
    const text = await this.flows.pageText();
    return text.split('\n').find((line) => /backup chain .* (is )?broken|manual (full|log) backup was detected/i.test(line)) ?? '';
  }

  // Everything the job page says, for an observed-outcome annotation.
  async annotateHistory(label: string): Promise<void> {
    const rows = (await this.host.backupHistory(this.db, 8)).map((row) => `${row.type}@${row.finishedAt}${row.deviceType === NBR_DEVICE ? '(NBR)' : '(native)'}`);
    this.note('observed-outcome', `${label}: msdb newest first: ${rows.join(', ')}`);
  }

  // ---- schedules ----

  // Edits the job (Edit wizard) to add Periodic schedules, remembers the msdb state so the first automatic run can be recognised.
  async addPeriodicSchedules(schedules: PeriodicSchedule[]): Promise<void> {
    this.beforeRun = nbrBackups(await this.host.backupHistory(this.db, 50));
    const confirmedWarning = await this.flows.addPeriodicSchedules(this.jobName, schedules);
    this.scheduled = true;
    if (confirmedWarning) this.note('observed-outcome', 'The self-backup warning appeared on Save and was confirmed');
    await this.deps.backupFlows.openJob(this.jobName);
  }

  // The first automatic run: a recovery point appears without anyone pressing Run, and the job page names the schedule that started it.
  async waitForScheduledRun(scheduleName: string, timeoutMs = 300_000): Promise<void> {
    await expect.poll(async () => (await this.freshBackups()).length, { message: 'no automatic run produced a recovery point', timeout: timeoutMs, intervals: [5_000] }).toBeGreaterThan(0);
    await this.deps.backupFlows.openJob(this.jobName);
    const outcome = await this.deps.backupFlows.waitForResult(300_000);
    expect(outcome, 'the scheduled run did not end successfully').toBe('successful');
    expect(await this.flows.pageText(), 'the job page does not name the schedule that started the run').toContain(scheduleName);
  }

  async expectFirstScheduledRunType(type: HistoryType): Promise<void> {
    const fresh = await this.freshBackups();
    expect(fresh[0]?.type, `first automatic recovery point type (all: ${fresh.map((row) => row.type).join(',')})`).toBe(type);
  }

  async expectOnlyTypes(allowed: HistoryType[]): Promise<void> {
    const fresh = await this.freshBackups();
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.filter((row) => !allowed.includes(row.type as HistoryType)).map((row) => row.type), 'lower-priority types ran while Full was due').toEqual([]);
  }

  // The scheduler's own note about a skipped lower-priority run (observed text: "... was skipped ... higher priority schedule #n").
  async skippedForPriorityLine(): Promise<string> {
    const text = await this.flows.pageText();
    return text.split('\n').find((line) => /skipped.*higher priority/i.test(line)) ?? '';
  }

  // ---- cleanup (afterEach) ----

  async cleanup(): Promise<void> {
    if (this.jobCreated || this.scheduled) {
      try {
        await this.flows.discardJobSafely(this.jobName, this.scheduled);
      } catch {
        // best effort: the original failure is what the report shows
      }
      this.jobCreated = false;
      this.scheduled = false;
    }
    if (!this.host) return;
    if (this.tableCreated) {
      try {
        await this.host.exec(`IF OBJECT_ID(N'[${checkName(this.db)}].dbo.${TABLE}') IS NOT NULL DROP TABLE [${checkName(this.db)}].dbo.${TABLE}`);
      } catch {
        // best effort
      }
      this.tableCreated = false;
    }
    if (this.originalModel && this.originalModel !== this.options.model) {
      try {
        await this.host.setRecoveryModel(this.db, this.originalModel as RecoveryModel);
      } catch {
        // best effort
      }
    }
  }

  get database(): string {
    return this.db;
  }

  get repository(): string {
    return this.repo;
  }

  get sourceItem(): string {
    return this.source.item;
  }

  get newBackupsSinceStart(): BackupHistoryRow[] {
    return this.baseline;
  }

  async allFreshSinceBaseline(): Promise<BackupHistoryRow[]> {
    return freshSince(this.baseline, nbrBackups(await this.host.backupHistory(this.db, 50)));
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
