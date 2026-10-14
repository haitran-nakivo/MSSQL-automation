import { execFile } from 'node:child_process';

// Runs T-SQL on a lab SQL Server from the tester's PC, for the cases that must change the source (create, rename, drop a
// database) and then look at what Director shows. No package is needed: it calls Windows PowerShell, which has the .NET SqlClient.
// The SQL login comes from the same target values the Add wizard uses (.env, read in helpers/credentials.ts); this file never reads
// .env itself and never prints the password (it travels in the child process environment, not on the command line).
// Never asserts: it returns what the server said, and throws on a connection or SQL error.

const CONNECT_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '$b = New-Object System.Data.SqlClient.SqlConnectionStringBuilder',
  "$b['Data Source'] = $env:QA_SQL_SERVER",
  "$b['User ID'] = $env:QA_SQL_USER",
  "$b['Password'] = $env:QA_SQL_PASSWORD",
  "$b['Initial Catalog'] = 'master'",
  "$b['Encrypt'] = $true",
  "$b['TrustServerCertificate'] = $true",
  "$b['Connect Timeout'] = 30",
  '$c = New-Object System.Data.SqlClient.SqlConnection($b.ConnectionString)',
  '$c.Open()',
  '$m = $c.CreateCommand()',
  '$m.CommandTimeout = 120',
  '$m.CommandText = $env:QA_SQL_QUERY',
  '$r = $m.ExecuteReader()',
  'do {',
  '  while ($r.Read()) {',
  '    $cells = @()',
  '    for ($i = 0; $i -lt $r.FieldCount; $i++) { $cells += [string]$r.GetValue($i) }',
  '    [Console]::Out.WriteLine($cells -join [char]9)',
  '  }',
  '} while ($r.NextResult())',
  '$c.Close()',
].join('\n');

const NAME = /^[A-Za-z0-9_]{1,60}$/;

export function checkName(name: string): string {
  if (!NAME.test(name)) throw new Error(`Refused a database name that is not letters, digits or underscores: ${name}`);
  return name;
}

export interface DatabaseIdentity {
  name: string;
  id: string;
  state: string;
}

export class SqlHost {
  readonly server: string;
  private readonly user: string;
  private readonly password: string;

  // `host` is the machine (or cluster name) Director connects to; `instanceName` is blank or "mssqlserver" for the default instance.
  constructor(host: string, instanceName: string | undefined, user: string, password: string) {
    const named = instanceName && instanceName.toLowerCase() !== 'mssqlserver' ? `\\${instanceName}` : '';
    this.server = `${host}${named}`;
    this.user = user;
    this.password = password;
  }

  // Rows as arrays of strings. A server that cannot be reached is an unmet precondition, so it is reported as ABORTED.
  async query(sql: string, timeoutMs = 150_000): Promise<string[][]> {
    const env = { ...process.env, QA_SQL_SERVER: this.server, QA_SQL_USER: this.user, QA_SQL_PASSWORD: this.password, QA_SQL_QUERY: sql };
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', CONNECT_SCRIPT],
        { env, timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
        (error, out, err) => {
          if (!error) return resolve(out);
          const firstLine = (err || error.message).split(/\r?\n/).find((line) => line.trim()) ?? 'unknown error';
          const cannotConnect = /network-related|instance-specific|timeout expired|login failed|cannot open/i.test(err);
          reject(new Error(`${cannotConnect ? 'ABORTED: ' : ''}SQL Server ${this.server}: ${firstLine.replace(this.password, '***')}`));
        },
      );
    });
    return stdout
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map((line) => line.split('\t'));
  }

  async exec(sql: string): Promise<void> {
    await this.query(sql);
  }

  async databaseNames(): Promise<string[]> {
    return (await this.query('SELECT name FROM sys.databases ORDER BY name')).map((row) => row[0]);
  }

  async identity(name: string): Promise<DatabaseIdentity | undefined> {
    const rows = await this.query(`SELECT name, database_id, state_desc FROM sys.databases WHERE name = N'${checkName(name)}'`);
    return rows.length ? { name: rows[0][0], id: rows[0][1], state: rows[0][2] } : undefined;
  }

  async createDatabase(name: string): Promise<void> {
    await this.exec(`CREATE DATABASE [${checkName(name)}]`);
  }

  async renameDatabase(from: string, to: string): Promise<void> {
    await this.exec(`ALTER DATABASE [${checkName(from)}] MODIFY NAME = [${checkName(to)}]`);
  }

  // Safe to call for a database that does not exist. Only databases the test created are ever dropped (callers pass their own names).
  async dropDatabaseIfExists(name: string): Promise<void> {
    const n = checkName(name);
    await this.exec(
      `IF DB_ID(N'${n}') IS NOT NULL BEGIN ALTER DATABASE [${n}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${n}]; END`,
    );
  }
}

// ---- Backup cases (added 2026-10-12; NOT yet exercised against a live server, like the rest of this file) ----
// Changes the recovery model of a database and reads backup history from msdb, so a case can prepare a database (SIMPLE / FULL /
// BULK_LOGGED), run a native (external) backup that is not NBR's, and look at what SQL Server recorded. Only the database names the
// owner lists in .env are touched; callers pass them in.
export type RecoveryModel = 'SIMPLE' | 'FULL' | 'BULK_LOGGED';
export type NativeBackupKind = 'FULL' | 'DIFFERENTIAL' | 'LOG';

export interface BackupHistoryRow {
  type: 'D' | 'I' | 'L' | string; // D full, I differential, L log
  finishedAt: string;
  copyOnly: boolean;
  deviceType: string; // 7 = virtual device (NBR / VDI), 2 = disk (native)
}

export class SqlBackupHost extends SqlHost {
  async recoveryModel(db: string): Promise<string> {
    const rows = await this.query(`SELECT recovery_model_desc FROM sys.databases WHERE name = N'${checkName(db)}'`);
    return rows.length ? rows[0][0] : '';
  }

  async setRecoveryModel(db: string, model: RecoveryModel): Promise<void> {
    await this.exec(`ALTER DATABASE [${checkName(db)}] SET RECOVERY ${model}`);
  }

  // A native backup to NUL-like disk target is not possible for Log/Diff chains, so the file goes to the instance's default backup folder.
  async nativeBackup(db: string, kind: NativeBackupKind, fileName: string): Promise<void> {
    const n = checkName(db);
    const file = checkName(fileName);
    const path = `(SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(400)))`;
    const target = `N'' + ${path} + N'\\${file}.bak'`;
    const sql =
      kind === 'LOG'
        ? `DECLARE @f nvarchar(500) = ${target}; BACKUP LOG [${n}] TO DISK = @f`
        : `DECLARE @f nvarchar(500) = ${target}; BACKUP DATABASE [${n}] TO DISK = @f ${kind === 'DIFFERENTIAL' ? 'WITH DIFFERENTIAL' : ''}`;
    await this.exec(sql);
  }

  async backupHistory(db: string, last = 10): Promise<BackupHistoryRow[]> {
    const rows = await this.query(
      `SELECT TOP (${Math.max(1, Math.min(50, last))}) bs.type, CONVERT(varchar(33), bs.backup_finish_date, 126), bs.is_copy_only, bmf.device_type ` +
        `FROM msdb.dbo.backupset bs JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id ` +
        `WHERE bs.database_name = N'${checkName(db)}' ORDER BY bs.backup_finish_date DESC`,
    );
    return rows.map((r) => ({ type: r[0], finishedAt: r[1], copyOnly: r[2] === '1' || r[2] === 'True', deviceType: r[3] }));
  }
}
