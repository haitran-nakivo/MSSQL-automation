import * as path from 'path';

export interface Credentials {
  username: string;
  password: string;
}

// The one reader of the repository-root .env: the credentials and the target Director's base URL.
// The repository root is the parent of helpers/. The file is found from this
// file's own location, never from the working directory, and nothing else is searched.
const ENV_FILE = path.resolve(__dirname, '..', '.env');

function loadEnvFile(): void {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch {
    throw new Error('The credentials file .env at the repository root could not be loaded');
  }
}

export function readCredentials(): Credentials {
  loadEnvFile();

  const username = process.env.NAKIVO_USERNAME;
  const password = process.env.NAKIVO_PASSWORD;

  const missing: string[] = [];
  if (!username) missing.push('NAKIVO_USERNAME');
  if (!password) missing.push('NAKIVO_PASSWORD');
  if (missing.length > 0) {
    throw new Error(`Missing in .env at the repository root: ${missing.join(', ')}`);
  }

  return { username: username as string, password: password as string };
}

// NAKIVO_BASE_URL is required. There is no default: a missing value must never fall back to another Director.
export function readBaseUrl(): string {
  loadEnvFile();

  const baseUrl = process.env.NAKIVO_BASE_URL;
  if (!baseUrl) {
    throw new Error('Missing in .env at the repository root: NAKIVO_BASE_URL');
  }

  let protocol: string;
  try {
    protocol = new URL(baseUrl).protocol;
  } catch {
    throw new Error('NAKIVO_BASE_URL in .env at the repository root is not a valid URL');
  }
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('NAKIVO_BASE_URL in .env at the repository root must start with http:// or https://');
  }

  return baseUrl;
}

export interface MssqlAgTarget {
  host: string;
  osUsername: string;
  osPassword: string;
  agName: string;
  sqlUsername: string;
  sqlPassword: string;
}

// The Microsoft SQL Server Always On availability group used by the Add-to-Inventory test. All six values are required.
export function readMssqlAgTarget(): MssqlAgTarget {
  loadEnvFile();

  const names = {
    host: 'NAKIVO_MSSQL_AG_HOST',
    osUsername: 'NAKIVO_MSSQL_OS_USERNAME',
    osPassword: 'NAKIVO_MSSQL_OS_PASSWORD',
    agName: 'NAKIVO_MSSQL_AG_NAME',
    sqlUsername: 'NAKIVO_MSSQL_SQL_USERNAME',
    sqlPassword: 'NAKIVO_MSSQL_SQL_PASSWORD',
  } as const;

  const missing = Object.values(names).filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing in .env at the repository root: ${missing.join(', ')}`);
  }

  return {
    host: process.env[names.host] as string,
    osUsername: process.env[names.osUsername] as string,
    osPassword: process.env[names.osPassword] as string,
    agName: process.env[names.agName] as string,
    sqlUsername: process.env[names.sqlUsername] as string,
    sqlPassword: process.env[names.sqlPassword] as string,
  };
}

export interface MssqlFciTarget {
  host: string;
  osUsername: string;
  osPassword: string;
  instanceName: string;
  sqlUsername: string;
  sqlPassword: string;
}

// The Microsoft SQL Server failover cluster instance used by the Add-to-Inventory test. All six values are required.
export function readMssqlFciTarget(): MssqlFciTarget {
  loadEnvFile();

  const names = {
    host: 'NAKIVO_MSSQL_FCI_HOST',
    osUsername: 'NAKIVO_MSSQL_FCI_OS_USERNAME',
    osPassword: 'NAKIVO_MSSQL_FCI_OS_PASSWORD',
    instanceName: 'NAKIVO_MSSQL_FCI_INSTANCE_NAME',
    sqlUsername: 'NAKIVO_MSSQL_FCI_SQL_USERNAME',
    sqlPassword: 'NAKIVO_MSSQL_FCI_SQL_PASSWORD',
  } as const;

  const missing = Object.values(names).filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing in .env at the repository root: ${missing.join(', ')}`);
  }

  return {
    host: process.env[names.host] as string,
    osUsername: process.env[names.osUsername] as string,
    osPassword: process.env[names.osPassword] as string,
    instanceName: process.env[names.instanceName] as string,
    sqlUsername: process.env[names.sqlUsername] as string,
    sqlPassword: process.env[names.sqlPassword] as string,
  };
}

export interface MssqlInstanceTarget {
  host: string;
  osUsername: string;
  osPassword: string;
  instanceName: string;
  sqlUsername: string;
  sqlPassword: string;
}

// The standalone Microsoft SQL Server instance used by the instance lifecycle test. All six values are required.
export function readMssqlInstanceTarget(): MssqlInstanceTarget {
  loadEnvFile();

  const names = {
    host: 'NAKIVO_MSSQL_INSTANCE_HOST',
    osUsername: 'NAKIVO_MSSQL_INSTANCE_OS_USERNAME',
    osPassword: 'NAKIVO_MSSQL_INSTANCE_OS_PASSWORD',
    instanceName: 'NAKIVO_MSSQL_INSTANCE_INSTANCE_NAME',
    sqlUsername: 'NAKIVO_MSSQL_INSTANCE_SQL_USERNAME',
    sqlPassword: 'NAKIVO_MSSQL_INSTANCE_SQL_PASSWORD',
  } as const;

  const missing = Object.values(names).filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing in .env at the repository root: ${missing.join(', ')}`);
  }

  return {
    host: process.env[names.host] as string,
    osUsername: process.env[names.osUsername] as string,
    osPassword: process.env[names.osPassword] as string,
    instanceName: process.env[names.instanceName] as string,
    sqlUsername: process.env[names.sqlUsername] as string,
    sqlPassword: process.env[names.sqlPassword] as string,
  };
}

// The Microsoft SQL Server Read-Scale availability group used by the Read-Scale lifecycle test. All six values are required.
// Same shape as the Always On availability group target: the form takes the same fields.
export function readMssqlReadScaleTarget(): MssqlAgTarget {
  loadEnvFile();

  const names = {
    host: 'NAKIVO_MSSQL_READSCALE_HOST',
    osUsername: 'NAKIVO_MSSQL_READSCALE_OS_USERNAME',
    osPassword: 'NAKIVO_MSSQL_READSCALE_OS_PASSWORD',
    agName: 'NAKIVO_MSSQL_READSCALE_AG_NAME',
    sqlUsername: 'NAKIVO_MSSQL_READSCALE_SQL_USERNAME',
    sqlPassword: 'NAKIVO_MSSQL_READSCALE_SQL_PASSWORD',
  } as const;

  const missing = Object.values(names).filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing in .env at the repository root: ${missing.join(', ')}`);
  }

  return {
    host: process.env[names.host] as string,
    osUsername: process.env[names.osUsername] as string,
    osPassword: process.env[names.osPassword] as string,
    agName: process.env[names.agName] as string,
    sqlUsername: process.env[names.sqlUsername] as string,
    sqlPassword: process.env[names.sqlPassword] as string,
  };
}

// Lab targets that run an UNSUPPORTED (too old) SQL Server version, for the cases that check the version block. Same six values as
// the other targets; the variable group is NAKIVO_MSSQL_OLD_<KIND>_* with the suffixes _HOST, _OS_USERNAME, _OS_PASSWORD,
// _INSTANCE_NAME (INSTANCE and FCI) or _AG_NAME (AG and READSCALE), _SQL_USERNAME, _SQL_PASSWORD. All six are required.
export function readMssqlOldInstanceTarget(kind: 'INSTANCE' | 'FCI'): MssqlInstanceTarget {
  loadEnvFile();

  const prefix = `NAKIVO_MSSQL_OLD_${kind}_`;
  const names = ['HOST', 'OS_USERNAME', 'OS_PASSWORD', 'INSTANCE_NAME', 'SQL_USERNAME', 'SQL_PASSWORD'].map((suffix) => prefix + suffix);
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing in .env at the repository root: ${missing.join(', ')}`);
  }

  return {
    host: process.env[names[0]] as string,
    osUsername: process.env[names[1]] as string,
    osPassword: process.env[names[2]] as string,
    instanceName: process.env[names[3]] as string,
    sqlUsername: process.env[names[4]] as string,
    sqlPassword: process.env[names[5]] as string,
  };
}

export function readMssqlOldAgTarget(kind: 'AG' | 'READSCALE'): MssqlAgTarget {
  loadEnvFile();

  const prefix = `NAKIVO_MSSQL_OLD_${kind}_`;
  const names = ['HOST', 'OS_USERNAME', 'OS_PASSWORD', 'AG_NAME', 'SQL_USERNAME', 'SQL_PASSWORD'].map((suffix) => prefix + suffix);
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing in .env at the repository root: ${missing.join(', ')}`);
  }

  return {
    host: process.env[names[0]] as string,
    osUsername: process.env[names[1]] as string,
    osPassword: process.env[names[2]] as string,
    agName: process.env[names[3]] as string,
    sqlUsername: process.env[names[4]] as string,
    sqlPassword: process.env[names[5]] as string,
  };
}

// A SQL login that authenticates but lacks the rights NBR needs (no sysadmin, no db_owner), for the insufficient-permission cases.
// The login must exist on the lab SQL servers (created by the owner). Both values are required.
export interface MssqlLowPermLogin {
  sqlUsername: string;
  sqlPassword: string;
}

export function readMssqlLowPermLogin(): MssqlLowPermLogin {
  loadEnvFile();

  const names = ['NAKIVO_MSSQL_LOWPERM_SQL_USERNAME', 'NAKIVO_MSSQL_LOWPERM_SQL_PASSWORD'];
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing in .env at the repository root: ${missing.join(', ')}`);
  }

  return { sqlUsername: process.env[names[0]] as string, sqlPassword: process.env[names[1]] as string };
}

// Targets of the OS and platform support cases (Feature Requirements/OS_Platform support). Each case has its own host, because each case is
// one Windows and SQL Server version combination. The variable group is NAKIVO_OSP_<CASE KEY WITHOUT THE DASH>_*, for example
// NAKIVO_OSP_NJM154361_HOST, with the suffixes _HOST, _OS_USERNAME, _OS_PASSWORD, _AG_NAME (Always On and Read-Scale) or _INSTANCE_NAME
// (instance and FCI), _SQL_USERNAME, _SQL_PASSWORD. All six are required; none exists until the owner adds the host. A missing value ends the
// test as ABORTED ("Missing in .env at the repository root").
function readOsPlatformValues(caseKey: string, nameSuffix: 'AG_NAME' | 'INSTANCE_NAME'): string[] {
  loadEnvFile();

  const prefix = `NAKIVO_OSP_${caseKey.replace('-', '')}_`;
  const names = ['HOST', 'OS_USERNAME', 'OS_PASSWORD', nameSuffix, 'SQL_USERNAME', 'SQL_PASSWORD'].map((suffix) => prefix + suffix);
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing in .env at the repository root: ${missing.join(', ')}`);
  }
  return names.map((name) => process.env[name] as string);
}

export function readOsPlatformAgTarget(caseKey: string): MssqlAgTarget {
  const [host, osUsername, osPassword, agName, sqlUsername, sqlPassword] = readOsPlatformValues(caseKey, 'AG_NAME');
  return { host, osUsername, osPassword, agName, sqlUsername, sqlPassword };
}

// A listener address with its logins and no AG name (the case finds the AG name from the SQL Server): NAKIVO_OSP_<KEY>_HOST, _OS_USERNAME,
// _OS_PASSWORD, _SQL_USERNAME, _SQL_PASSWORD. A missing value ends the test as ABORTED, like the other readers.
export interface AgListenerTarget {
  host: string;
  osUsername: string;
  osPassword: string;
  sqlUsername: string;
  sqlPassword: string;
}

export function readOsPlatformAgListenerTarget(caseKey: string): AgListenerTarget {
  const prefix = `NAKIVO_OSP_${caseKey.replace('-', '')}_`;
  const [host, osUsername, osPassword, sqlUsername, sqlPassword] = readEnvValues(['HOST', 'OS_USERNAME', 'OS_PASSWORD', 'SQL_USERNAME', 'SQL_PASSWORD'].map((suffix) => prefix + suffix));
  return { host, osUsername, osPassword, sqlUsername, sqlPassword };
}

export function readOsPlatformInstanceTarget(caseKey: string): MssqlInstanceTarget {
  const [host, osUsername, osPassword, instanceName, sqlUsername, sqlPassword] = readOsPlatformValues(caseKey, 'INSTANCE_NAME');
  return { host, osUsername, osPassword, instanceName, sqlUsername, sqlPassword };
}

// Backup / Backup Copy / Backup Encryption cases: names of the Inventory items, databases and repositories the owner provides in .env
// (NAKIVO_BK_* ; see helpers/backup-env.ts). Same rule as the other readers: a missing value throws "Missing in .env at the repository
// root: ...", which the reporter shows as ABORTED. Nothing is defaulted or invented.
export function readEnvValues(names: string[]): string[] {
  loadEnvFile();
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing in .env at the repository root: ${missing.join(', ')}`);
  }
  return names.map((name) => process.env[name] as string);
}
