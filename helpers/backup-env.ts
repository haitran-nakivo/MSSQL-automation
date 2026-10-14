import {
  readEnvValues,
  readMssqlAgTarget,
  readMssqlFciTarget,
  readMssqlInstanceTarget,
  readMssqlReadScaleTarget,
} from './credentials';
import { SqlBackupHost, type RecoveryModel } from './sql-host';

// Environment of the Backup / Backup Copy / Backup Encryption cases. The owner supplies it in .env (nothing here is invented):
//
//   NAKIVO_BK_<KIND>_ITEM            Display name of an EXISTING Inventory item that the job backs up. KIND = INSTANCE | FCI | AG | READSCALE.
//   NAKIVO_BK_<KIND>_DB_SIMPLE       a database on that item in SIMPLE recovery model (also _DB_FULL, _DB_BULK_LOGGED).
//   NAKIVO_BK_REPO_<ROLE>            name of an existing, Online backup repository. ROLE = PRIMARY (any stream repository) | SECONDARY (a
//                                    second one, the target of Backup Copy) | LOCAL | CIFS | NFS | S3 | WASABI | B2 | AZURE | EC2 |
//                                    GENERIC_S3 | DEDUP | IMMUTABLE (a repository that supports immutability).
//   NAKIVO_BK_TAPE_<NAME>            tape resources (LIBRARY, DRIVE) for the copy-to-tape cases.
//   NAKIVO_BK_<ANYTHING ELSE>        a case-specific value; the spec names it in its header comment.
//
// The host and the SQL login of each KIND come from the NAKIVO_MSSQL_<KIND>_* groups that the Inventory cases already use (the same
// lab hosts), so no second copy of a credential exists. A value that is missing throws "Missing in .env at the repository root: ...",
// which the reporter shows as ABORTED. This file reads .env only through helpers/credentials.ts.

export type SourceKind = 'INSTANCE' | 'FCI' | 'AG' | 'READSCALE';
export type RepoRole =
  | 'PRIMARY'
  | 'SECONDARY'
  | 'LOCAL'
  | 'CIFS'
  | 'NFS'
  | 'S3'
  | 'WASABI'
  | 'B2'
  | 'AZURE'
  | 'EC2'
  | 'GENERIC_S3'
  | 'DEDUP'
  | 'IMMUTABLE';

export interface BackupSource {
  kind: SourceKind;
  /** Display name of the Inventory item, as listed in Settings > Inventory and in the job's source tree. */
  item: string;
  host: string;
  /** Instance name for a standalone instance or FCI; undefined for a group (the default instance of the host is used). */
  instanceName: string | undefined;
  sqlUsername: string;
  sqlPassword: string;
}

const MODEL_SUFFIX: Record<RecoveryModel, string> = { SIMPLE: 'SIMPLE', FULL: 'FULL', BULK_LOGGED: 'BULK_LOGGED' };

function sqlLogin(kind: SourceKind): { host: string; instanceName: string | undefined; sqlUsername: string; sqlPassword: string } {
  switch (kind) {
    case 'INSTANCE': {
      const t = readMssqlInstanceTarget();
      return { host: t.host, instanceName: t.instanceName, sqlUsername: t.sqlUsername, sqlPassword: t.sqlPassword };
    }
    case 'FCI': {
      const t = readMssqlFciTarget();
      return { host: t.host, instanceName: t.instanceName, sqlUsername: t.sqlUsername, sqlPassword: t.sqlPassword };
    }
    case 'AG': {
      const t = readMssqlAgTarget();
      return { host: t.host, instanceName: undefined, sqlUsername: t.sqlUsername, sqlPassword: t.sqlPassword };
    }
    case 'READSCALE': {
      const t = readMssqlReadScaleTarget();
      return { host: t.host, instanceName: undefined, sqlUsername: t.sqlUsername, sqlPassword: t.sqlPassword };
    }
  }
}

// The Inventory item a backup case uses, and the login to reach its SQL Server.
export function readBackupSource(kind: SourceKind): BackupSource {
  const [item] = readEnvValues([`NAKIVO_BK_${kind}_ITEM`]);
  return { kind, item, ...sqlLogin(kind) };
}

// The database a case needs in a given recovery model. The database must already exist on the item (the owner lists it in .env);
// a case that needs a different model than the database has changes it with SqlBackupHost.setRecoveryModel and restores it.
export function readBackupDatabase(kind: SourceKind, model: RecoveryModel): string {
  const [name] = readEnvValues([`NAKIVO_BK_${kind}_DB_${MODEL_SUFFIX[model]}`]);
  return name;
}

export function readBackupRepo(role: RepoRole): string {
  const [name] = readEnvValues([`NAKIVO_BK_REPO_${role}`]);
  return name;
}

// A case-specific value, for example NAKIVO_BK_TAPE_LIBRARY. `name` is the part after NAKIVO_BK_.
export function readBackupValue(name: string): string {
  const [value] = readEnvValues([`NAKIVO_BK_${name}`]);
  return value;
}

export function sqlHostFor(source: BackupSource): SqlBackupHost {
  return new SqlBackupHost(source.host, source.instanceName, source.sqlUsername, source.sqlPassword);
}

// Name of the job a case creates: the Xray key, so a job is traceable to its case and cleanup finds only its own jobs.
export const backupJobName = (caseKey: string, suffix = ''): string => `${caseKey}${suffix}`;
