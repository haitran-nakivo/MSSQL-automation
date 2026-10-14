import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { checkName } from '../../../../../helpers/sql-host';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154677: "[MSSQL-BK-Chain-0004] Verify Data Storage Across Sessions" (data set A in session 1, data set B in session 2).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154677 (deleted in afterEach, backups kept) and, in the database named by NAKIVO_BK_INSTANCE_DB_FULL, the table dbo.QA_NJM154677
//   (500 rows per data set, dropped in afterEach). Runs one Full (session 1) and one Differential (session 2).
// case-vs-ui: the content of a backup cannot be opened from the UI without a restore (the restore wizard is not automated here, see NJM-154680). "Both sessions are in the chain" is asserted as:
//   the session-2 point is a Differential based on the session-1 Full in msdb and its size shows the data set B (more than 500 KB changed), while the Full holds data set A (size above 1 MB).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154677');
const TABLE = 'dbo.QA_NJM154677';
let jobCreated = false;
let tableDb = '';
let tableHost: ReturnType<typeof sqlHostFor> | undefined;

test.afterEach(async ({ backupFlows }) => {
  if (tableHost && tableDb) {
    try { await tableHost.exec(`IF OBJECT_ID(N'[${checkName(tableDb)}].${TABLE}') IS NOT NULL DROP TABLE [${checkName(tableDb)}].${TABLE}`); } catch { /* best effort */ }
  }
  tableHost = undefined;
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO keeps the data of two backup sessions in one chain: a Full with data set A and a Differential with data set B', { tag: '@NJM-154677' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const msdb = new MsdbChain(host, db);
  const chain = new ChainFlows(page, backupFlows);
  const mark = { value: 0 };
  const insert = (set: string) =>
    `INSERT INTO [${checkName(db)}].${TABLE} (data_set, payload) SELECT TOP (500) '${set}', REPLICATE('x', 2000) FROM sys.all_objects a CROSS JOIN sys.all_objects b`;

  await test.step('1. Precondition: the SQL Server item is in Inventory and the database is in FULL recovery model', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
    const model = await host.recoveryModel(db);
    if (model !== 'FULL') throw new Error(`ABORTED: database ${db} is in ${model || 'an unknown'} recovery model, the case needs FULL`);
    const existing = await host.query(`SELECT OBJECT_ID(N'[${checkName(db)}].${TABLE}')`);
    if (existing[0]?.[0]) throw new Error(`ABORTED: table ${TABLE} already exists in ${db}; drop it and run again`);
  });

  await test.step('2. The stream repository is selectable as the destination (the job is created with it)', async () => {
    mark.value = await msdb.watermark();
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('3. Insert data set A and run a backup (session 1): the session-1 Full is created', async () => {
    tableDb = db;
    tableHost = host;
    await host.exec(`CREATE TABLE [${checkName(db)}].${TABLE} (id int IDENTITY(1,1) PRIMARY KEY, data_set char(1) NOT NULL, payload char(2000) NOT NULL)`);
    await host.exec(insert('A'));
    const { outcome, backups } = await chain.runStep(msdb);
    expect(outcome).toBe('successful');
    expect(backups.map((b) => b.type)).toEqual(['D']);
    expect(backups[0].sizeBytes, 'the Full is too small to hold data set A').toBeGreaterThan(1_000_000);
  });

  await test.step('4. Insert data set B and run another backup (session 2): the session-2 Differential is created', async () => {
    await host.exec(insert('B'));
    const { outcome, backups } = await chain.runStep(msdb, { type: 'Differential' });
    expect(outcome).toBe('successful');
    expect(backups.map((b) => b.type)).toEqual(['I']);
    expect(backups[0].sizeBytes, 'the Differential is too small to hold data set B').toBeGreaterThan(500_000);
  });

  await test.step('5. Verify the chain across the two sessions: session 2 is based on the session-1 Full and the database holds both data sets', async () => {
    const sets = await msdb.since(mark.value);
    expect(sets.map((b) => b.type)).toEqual(['D', 'I']);
    expect(sets[1].differentialBaseGuid).toBe(sets[0].uuid);
    const counts = await host.query(`SELECT data_set, COUNT(*) FROM [${checkName(db)}].${TABLE} GROUP BY data_set ORDER BY data_set`);
    expect(counts).toEqual([['A', '500'], ['B', '500']]);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Backup content is not opened (no restore); presence of sets A and B is inferred from msdb types, base GUID and sizes.' });
  });
});
