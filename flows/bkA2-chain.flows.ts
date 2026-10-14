import type { Page } from '@playwright/test';
import { BackupFlows } from './backup.flows';
import type { JobOutcome, ScheduleOptions } from './backup.flows';
import { BkA2RecoveryPage, BkA2RepositoryPage } from '../pages/bkA2-recovery.page';
import type { SqlBackupType } from '../pages/backup-wizard.page';
import { checkName } from '../helpers/sql-host';
import { viewingPause } from '../helpers/viewing-pause';
import type { SqlBackupHost } from '../helpers/sql-host';

// Flows for the Backup Scope cases of Chain / Workflow / General requirements (assignment A2): create a one-database job, run Full /
// Differential / Log through the Run dialog, wait for the result, and read what SQL Server recorded in msdb (the external truth for chain
// links: the UI of 11.2.1 does not show a chain id or a parent id). Same rules as every flows file: no assertions, no .env, no fixed waits.
// Not yet run live. UNVERIFIED parts are marked in place (run with a schedule, recovery-point picker, repository page, Edit > destination).

export interface ChainJobRequest {
  name: string;
  item: string;
  databases: string[];
  repo: string;
  /** No schedule: "Do not schedule, run on demand". */
  schedules?: ScheduleOptions[];
  options?: { concurrentStreams?: number };
}

export interface RunStepOptions {
  /** Omitted: the Run dialog keeps its own default (the first run of a job has no type combo and is a Full). */
  type?: SqlBackupType;
  /** Name of a schedule of the job to run with (its SQL backup type applies while the job has no Full yet). */
  schedule?: string;
  timeoutMs?: number;
}

export interface MsdbBackup {
  setId: number;
  /** D full, I differential, L log. */
  type: string;
  uuid: string;
  differentialBaseGuid: string;
  firstLsn: string;
  lastLsn: string;
  checkpointLsn: string;
  databaseBackupLsn: string;
  finishedAt: string;
  copyOnly: boolean;
  mediaFamilies: number;
  deviceType: string;
  /** backup_size in bytes. */
  sizeBytes: number;
}

// What SQL Server recorded for one database in msdb.dbo.backupset. A test takes a watermark before a run and reads what is new after it.
export class MsdbChain {
  private readonly db: string;

  constructor(private readonly host: SqlBackupHost, db: string) {
    this.db = checkName(db);
  }

  async watermark(): Promise<number> {
    const rows = await this.host.query(`SELECT ISNULL(MAX(backup_set_id), 0) FROM msdb.dbo.backupset WHERE database_name = N'${this.db}'`);
    return Number(rows[0]?.[0] ?? 0);
  }

  // Backup sets of the database with an id above the watermark, oldest first.
  async since(mark: number): Promise<MsdbBackup[]> {
    const rows = await this.host.query(
      'SELECT bs.backup_set_id, bs.type, CAST(bs.backup_set_uuid AS varchar(40)), ISNULL(CAST(bs.differential_base_guid AS varchar(40)), \'\'), ' +
        'CAST(bs.first_lsn AS varchar(40)), CAST(bs.last_lsn AS varchar(40)), CAST(bs.checkpoint_lsn AS varchar(40)), ISNULL(CAST(bs.database_backup_lsn AS varchar(40)), \'\'), ' +
        'CONVERT(varchar(33), bs.backup_finish_date, 126), bs.is_copy_only, ' +
        '(SELECT COUNT(*) FROM msdb.dbo.backupmediafamily f WHERE f.media_set_id = bs.media_set_id), ' +
        '(SELECT MIN(f.device_type) FROM msdb.dbo.backupmediafamily f WHERE f.media_set_id = bs.media_set_id), CAST(bs.backup_size AS bigint) ' +
        `FROM msdb.dbo.backupset bs WHERE bs.database_name = N'${this.db}' AND bs.backup_set_id > ${Math.trunc(mark)} ORDER BY bs.backup_set_id`,
    );
    return rows.map((r) => ({
      setId: Number(r[0]),
      type: r[1],
      uuid: r[2].toLowerCase(),
      differentialBaseGuid: r[3].toLowerCase(),
      firstLsn: r[4],
      lastLsn: r[5],
      checkpointLsn: r[6],
      databaseBackupLsn: r[7],
      finishedAt: r[8],
      copyOnly: r[9] === '1' || r[9] === 'True',
      mediaFamilies: Number(r[10]),
      deviceType: r[11],
      sizeBytes: Number(r[12]),
    }));
  }

  // Distinct device names (the VDI device GUIDs of a stream backup) of one backup set.
  async devices(setId: number): Promise<string[]> {
    const rows = await this.host.query(
      `SELECT DISTINCT f.physical_device_name FROM msdb.dbo.backupset bs JOIN msdb.dbo.backupmediafamily f ON f.media_set_id = bs.media_set_id WHERE bs.backup_set_id = ${Math.trunc(setId)}`,
    );
    return rows.map((r) => r[0]);
  }
}

export class ChainFlows {
  readonly recovery: BkA2RecoveryPage;
  readonly repository: BkA2RepositoryPage;

  private readonly page: Page;

  constructor(page: Page, private readonly bk: BackupFlows) {
    this.page = page;
    this.recovery = new BkA2RecoveryPage(page);
    this.repository = new BkA2RepositoryPage(page);
  }

  // Creates the job with plain Finish (never run) and waits for its page. A job with this name that already exists is not ours: ABORTED.
  async createJob(request: ChainJobRequest): Promise<void> {
    if (await this.bk.jobExists(request.name)) throw new Error(`ABORTED: a job named "${request.name}" already exists; remove it and run again`);
    await this.bk.createJob({
      name: request.name,
      sources: [{ item: request.item, databases: request.databases }],
      destination: request.repo,
      schedules: request.schedules,
      options: request.options,
      finish: 'finish',
    });
    await this.bk.jobs.runButton.waitFor({ timeout: 30_000 });
  }

  // Runs the open job and waits until the run ended. The first run of a job has no type combo (it is a Full).
  async runAndWait(options: RunStepOptions = {}): Promise<JobOutcome> {
    if (options.schedule) {
      await this.runWithSchedule(options.schedule);
    } else {
      await this.bk.runOpenJob(options.type ? { sqlBackupType: options.type } : {});
    }
    await this.waitRunning();
    return this.bk.waitForResult(options.timeoutMs ?? 300_000);
  }

  // The old status text stays on the page until the new run shows "Running (", so wait for it first (a very short run may skip it).
  private async waitRunning(): Promise<void> {
    try {
      await this.page.waitForFunction(() => /Running \(/.test(document.body.innerText), undefined, { timeout: 60_000, polling: 500 });
    } catch {
      // the run was already over, or it never showed "Running (": waitForResult decides
    }
  }

  // UNVERIFIED: the Run dialog's "Select schedule" control (notes: "Select schedule (combo '<name> - Weekly (Keep recovery point for 10 days)')",
  // disabled for on-demand jobs). The label is clicked to enable the combo when it is disabled, then the schedule is picked by its name.
  private async runWithSchedule(scheduleName: string): Promise<void> {
    const jobs = this.bk.jobs;
    await jobs.runButton.click({ timeout: 10_000 });
    await jobs.runDialog.waitFor({ timeout: 15_000 });
    const label = jobs.runDialog.getByText('Select schedule', { exact: false }).first();
    const combo = label.locator('xpath=following::input[1]');
    if (await this.bk.isDisabled(combo)) await label.click({ timeout: 10_000 });
    const shown = await combo.inputValue().catch(() => '');
    if (!shown.includes(scheduleName)) {
      await combo.click({ timeout: 10_000 });
      await this.page.getByText(scheduleName, { exact: false }).filter({ visible: true }).last().click({ timeout: 10_000 });
    }
    await jobs.runDialogRunButton.click({ timeout: 10_000 });
  }

  // One run plus what SQL Server recorded for it.
  async runStep(msdb: MsdbChain, options: RunStepOptions = {}): Promise<{ outcome: JobOutcome; backups: MsdbBackup[] }> {
    const mark = await msdb.watermark();
    const outcome = await this.runAndWait(options);
    return { outcome, backups: await msdb.since(mark) };
  }

  // The source SQL Server must have the database in the given recovery model (read only; this file never changes it).
  async recoveryModelOf(host: SqlBackupHost, db: string): Promise<string> {
    return host.recoveryModel(db);
  }

  // UNVERIFIED (see pages/bkA2-recovery.page.ts): Recover on the job page > "Full recovery for individual database" > the recovery-point
  // picker. Returns the leaf texts on screen once the picker marker is visible; the wizard stays open (close it with closeRecovery).
  async openRecoveryPicker(): Promise<string[]> {
    await this.bk.jobs.recoverButton.click({ timeout: 10_000 });
    await this.recovery.recoverOption.click({ timeout: 10_000 });
    await this.recovery.pickerMarker.waitFor({ timeout: 30_000 });
    return this.bk.visibleTexts();
  }

  // UNVERIFIED: Next on the recovery-point picker accepts the selected point and moves the recovery wizard on; then the viewing pause.
  async acceptRecoveryPoint(): Promise<void> {
    await this.recovery.nextButton.click({ timeout: 10_000 });
    await viewingPause();
  }

  async closeRecovery(): Promise<void> {
    if (await this.recovery.cancelButton.isVisible().catch(() => false)) {
      await this.recovery.cancelButton.click({ timeout: 10_000 });
      return;
    }
    await this.page.keyboard.press('Escape');
  }

  // Settings > Repositories > <repo>: the leaf texts of the repository page (its Backups list).
  async readRepositoryTexts(repoName: string): Promise<string[]> {
    await this.repository.goto();
    await this.repository.repositoryRow(repoName).click({ timeout: 15_000 });
    await this.repository.backupRowOfJob('').first().waitFor({ timeout: 30_000 }).catch(() => undefined);
    return this.bk.visibleTexts();
  }

  async repositoryBackupRowCount(repoName: string, jobName: string): Promise<number> {
    await this.repository.goto();
    await this.repository.repositoryRow(repoName).click({ timeout: 15_000 });
    await this.repository.backupRowOfJob(jobName).first().waitFor({ timeout: 30_000 }).catch(() => undefined);
    return this.repository.backupRowOfJob(jobName).count();
  }

  // UNVERIFIED: Edit on the job page > Destination tab > another repository > Save, then "Change backup destination?" > Change (the old
  // backups stay in the old repository). After this the Run dialog has no SQL backup type and the next run is a Full (notes 2026-10-08).
  async changeDestination(repoName: string): Promise<void> {
    await this.page.getByText('Edit', { exact: true }).filter({ visible: true }).first().click({ timeout: 10_000 });
    await this.bk.wizard.title.waitFor({ timeout: 30_000 });
    await this.bk.goToStep('Destination');
    await this.bk.chooseDestination(repoName);
    await this.confirmChange();
    await this.bk.wizard.saveButton.first().click({ timeout: 10_000 });
    await this.confirmChange();
    await this.bk.jobs.runButton.waitFor({ timeout: 30_000 });
  }

  private async confirmChange(): Promise<void> {
    const dialog = this.page.locator('.x-window:visible').filter({ hasText: 'Change backup destination' }).last();
    try {
      await dialog.waitFor({ state: 'visible', timeout: 4_000 });
    } catch {
      return; // no confirmation was asked at this point
    }
    await dialog.getByText('Change', { exact: true }).last().click({ timeout: 10_000 });
  }
}
