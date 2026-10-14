import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154713: "[MSSQL-BK-WF-0010] Verify Log Linking (Initial)" (with no earlier Log, the first Log is linked to the latest Full / Differential).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154713 (deleted in afterEach, backups kept); runs one Full and one Log backup (L1).
// case-vs-ui: the UI shows no parent id of L1. The link is read from msdb: L1.database_backup_lsn is the Full's checkpoint_lsn and L1.first_lsn is at or before the Full's last_lsn.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154713');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO links the first Log backup of a chain to the Full backup', { tag: '@NJM-154713' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const msdb = new MsdbChain(host, db);
  const chain = new ChainFlows(page, backupFlows);
  let full: Awaited<ReturnType<ChainFlows['runStep']>>['backups'][number] | undefined;

  await test.step('1. Precondition: the SQL Server item is in Inventory and the database is in FULL recovery model', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
    const model = await host.recoveryModel(db);
    if (model !== 'FULL') throw new Error(`ABORTED: database ${db} is in ${model || 'an unknown'} recovery model, the case needs FULL`);
  });

  await test.step('2. The stream repository is selectable as the destination (the job is created with it)', async () => {
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('3. Run a Full backup: a Full recovery point is created', async () => {
    const { outcome, backups } = await chain.runStep(msdb);
    expect(outcome).toBe('successful');
    expect(backups.map((b) => b.type)).toEqual(['D']);
    full = backups[0];
  });

  await test.step('4. Run a Log backup (L1): L1 is created', async () => {
    const { outcome, backups } = await chain.runStep(msdb, { type: 'Log' });
    expect(outcome).toBe('successful');
    expect(backups.map((b) => b.type)).toEqual(['L']);
    const l1 = backups[0];
    testInfo.annotations.push({ type: 'observed-outcome', description: `L1 database_backup_lsn ${l1.databaseBackupLsn}; Full checkpoint_lsn ${full!.checkpointLsn}` });
    expect(l1.databaseBackupLsn, 'L1 is not based on the Full').toBe(full!.checkpointLsn);
    expect(BigInt(l1.firstLsn) <= BigInt(full!.lastLsn), 'L1 does not continue from the Full').toBe(true);
  });

  await test.step('5. Inspect the linkage of L1: the parent is the Full backup', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The parent id is read as LSN linkage in msdb; the UI does not show it.' });
  });
});
