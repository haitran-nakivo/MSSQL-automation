// The automation that exists: Xray test key -> the Playwright spec that runs it. One entry per implemented case.
// A key is added here only when its spec is tagged @<KEY>, its assertions decide the verdict, and the case's scope line
// (what is and is not verified) is written. registry.ts checks the spec file and the tag on every start.

export interface Implementation {
  key: string;
  // Shown in the interface when the case is not in the assessed scope data.
  title: string;
  // Spec path relative to the repository root.
  spec: string;
  // Hard limit for one run. The runner kills the whole process tree after it and reports ABORTED.
  timeoutMs: number;
  // Pre-flight checks that must pass before the browser is started (see preflight/checks.ts).
  requires: Array<'director' | 'build'>;
  // Variables that must be set in .env for this case (names only).
  requiresEnv: string[];
  // Overrides the generated scope line when the case lives outside the assessed folder.
  scopeLine?: string;
  notVerified?: string;
}

export const IMPLEMENTATIONS: Record<string, Implementation> = {
  'NJM-187289': {
    key: 'NJM-187289',
    title: 'Verify adding/ editing/ removing Windows Server 2025 hosting SQL Server 2025 Enterprise - MSSQL Read-Scale AG',
    spec: 'tests/DBs_Services_Apps product/Microsoft SQL Server Database/Feature Requirements/OS_Platform support/Discovery/NJM-187289.spec.ts',
    timeoutMs: 30 * 60_000,
    requires: ['director', 'build'],
    requiresEnv: [
      'NAKIVO_MSSQL_READSCALE_HOST',
      'NAKIVO_MSSQL_READSCALE_OS_USERNAME',
      'NAKIVO_MSSQL_READSCALE_OS_PASSWORD',
      'NAKIVO_MSSQL_READSCALE_AG_NAME',
      'NAKIVO_MSSQL_READSCALE_SQL_USERNAME',
      'NAKIVO_MSSQL_READSCALE_SQL_PASSWORD',
    ],
    scopeLine:
      'Adjusted to the current NBR UI. Verified: add, discovery, operating system (Windows Server 2025) and SQL version (17.x = SQL Server 2025), Edit pre-populated, Display name change and rediscovery, Remove, item gone. Not verified: the Enterprise edition (the current UI shows no SQL edition); no credential is changed (only one valid pair exists).',
    notVerified: 'SQL edition (not displayed by NBR 11.2.1); a credential change.',
  },
};
