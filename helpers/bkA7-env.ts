import { readBackupDatabase, readBackupRepo, readBackupValue } from './backup-env';

// Environment readers owned by assignment A7 (Data Transfer / Options / Backup Encryption / Backup Copy to Tape cases).
// Everything comes from .env through helpers/backup-env.ts; a missing value makes the spec end ABORTED ("Missing in .env ...").
//
// Names (all in .env, owner-supplied):
//   NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY   the standalone instance, a database on it, a repository
//   NAKIVO_BK_STREAMS_CAP_ITEM / _DB / _CPU / _RAM_GB     NJM-154869: an Inventory item whose transporter host has the known vCPU and RAM (case: 2 vCPU, 3 GB)
//   NAKIVO_BK_STREAMS_LOW_ITEM / _DB / _CPU / _RAM_GB     NJM-154870: same for the low-resource host (case: 1 vCPU, 1 GB)
//   NAKIVO_BK_TRANSPORTER_LOAD_LIMIT                      NJM-171457 / 171459: the <load-limit> value, read only when the Options step shows that control
//   NAKIVO_BK_TAPE_LIBRARY, NAKIVO_BK_TAPE_MEDIA_POOL, NAKIVO_BK_TAPE_DRIVE (standalone drive), NAKIVO_BK_TAPE_MAX_DRIVES,
//   NAKIVO_BK_TAPE_DBS (comma list of databases on the instance for the parallel-drive cases), NAKIVO_BK_TAPE_SQL_BACKUP (name of a SQL backup that is already on tape),
//   NAKIVO_BK_REPO_SECONDARY, NAKIVO_BK_TAPE_NO_REPOSITORY (the word "yes" when the Director has no repository, for NJM-178407)

export interface A7Setup {
  item: string;
  db: string;
  repo: string;
}

// The standalone instance item, one of its databases and a repository (UI-only cases need no SQL login).
export function readA7Setup(): A7Setup {
  return { item: readBackupValue('INSTANCE_ITEM'), db: readBackupDatabase('INSTANCE', 'SIMPLE'), repo: readBackupRepo('PRIMARY') };
}

export interface StreamsHost extends A7Setup {
  cpu: number;
  ramGb: number;
  /** Streams the Director may use on this host: the lower of 2 per vCPU and 5 per GB of RAM (RAM / 0.2). */
  limit: number;
}

export function readStreamsHost(name: 'CAP' | 'LOW'): StreamsHost {
  const item = readBackupValue(`STREAMS_${name}_ITEM`);
  const db = readBackupValue(`STREAMS_${name}_DB`);
  const cpu = Number(readBackupValue(`STREAMS_${name}_CPU`));
  const ramGb = Number(readBackupValue(`STREAMS_${name}_RAM_GB`));
  if (!Number.isFinite(cpu) || cpu <= 0 || !Number.isFinite(ramGb) || ramGb <= 0) {
    throw new Error(`ABORTED: NAKIVO_BK_STREAMS_${name}_CPU and _RAM_GB must be positive numbers`);
  }
  return { item, db, repo: readBackupRepo('PRIMARY'), cpu, ramGb, limit: Math.min(Math.floor(cpu * 2), Math.floor(ramGb / 0.2)) };
}

export function readLoadLimit(): string {
  return readBackupValue('TRANSPORTER_LOAD_LIMIT');
}

export interface TapeSetup {
  library: string;
  mediaPool: string;
}

export function readTapeLibrary(): TapeSetup {
  return { library: readBackupValue('TAPE_LIBRARY'), mediaPool: readBackupValue('TAPE_MEDIA_POOL') };
}

export function readTapeDrive(): string {
  return readBackupValue('TAPE_DRIVE');
}

export function readTapeMaxDrives(): number {
  const n = Number(readBackupValue('TAPE_MAX_DRIVES'));
  if (!Number.isInteger(n) || n < 1) throw new Error('ABORTED: NAKIVO_BK_TAPE_MAX_DRIVES must be a positive integer');
  return n;
}

export function readTapeDatabases(): string[] {
  const list = readBackupValue('TAPE_DBS').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length < 2) throw new Error('ABORTED: NAKIVO_BK_TAPE_DBS must list at least two databases (comma separated)');
  return list;
}

export function readTapeSqlBackup(): string {
  return readBackupValue('TAPE_SQL_BACKUP');
}

export function readSecondaryRepo(): string {
  return readBackupRepo('SECONDARY');
}

export function readNoRepositoryFlag(): boolean {
  return readBackupValue('TAPE_NO_REPOSITORY').trim().toLowerCase() === 'yes';
}

// NAKIVO_BK_RECOVERY_CONFIRMED = "yes": the owner confirms that the Recover wizard defaults are safe for the lab (the wizard was never explored, so the spec cannot choose a
// "recover as a new database" target itself and would otherwise risk overwriting the source database). Without it the recovery cases end ABORTED.
export function readRecoveryConfirmed(): boolean {
  return readBackupValue('RECOVERY_CONFIRMED').trim().toLowerCase() === 'yes';
}
