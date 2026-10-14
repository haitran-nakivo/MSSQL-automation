import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154712: "[MSSQL-BK-WF-0009] Verify Log Linking (Sequential)" (a Log backup is linked to the previous Log).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154712 (deleted in afterEach, backups kept); runs one Full and two Log backups.
// case-vs-ui: the case starts with a Log backup L1 on an empty chain. In the product a first run is always a Full (a Log with no Full runs a Full instead, see NJM-154697), so a Full is run first and
//   L1 / L2 are the two Log backups after it. The UI shows no "parent id"; the link is read from msdb: L2.first_lsn is at or before L1.last_lsn (no gap) and both logs hang on the same Full.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154712');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO links the second Log backup to the first Log backup of the chain', { tag: '@NJM-154712' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const msdb = new MsdbChain(host, db);
  const chain = new ChainFlows(page, backupFlows);
  let full: Awaited<ReturnType<ChainFlows['runStep']>>['backups'][number] | undefined;
  let l1: typeof full;

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

  await test.step('3. Run the base Full and the first Log backup (L1): L1 is created', async () => {
    const first = await chain.runStep(msdb);
    expect(first.outcome).toBe('successful');
    full = first.backups[0];
    const second = await chain.runStep(msdb, { type: 'Log' });
    expect(second.outcome).toBe('successful');
    expect(second.backups.map((b) => b.type)).toEqual(['L']);
    l1 = second.backups[0];
  });

  await test.step('4. Run a second Log backup (L2): L2 is created', async () => {
    const { outcome, backups } = await chain.runStep(msdb, { type: 'Log' });
    expect(outcome).toBe('successful');
    expect(backups.map((b) => b.type)).toEqual(['L']);
    const l2 = backups[0];
    testInfo.annotations.push({ type: 'observed-outcome', description: `L1 first/last LSN ${l1!.firstLsn}/${l1!.lastLsn}; L2 first/last LSN ${l2.firstLsn}/${l2.lastLsn}` });
    expect(l2.databaseBackupLsn).toBe(full!.checkpointLsn);
    expect(BigInt(l2.firstLsn) <= BigInt(l1!.lastLsn), 'L2 does not continue from L1').toBe(true);
    expect(BigInt(l2.lastLsn) >= BigInt(l1!.lastLsn)).toBe(true);
  });

  await test.step('5. Inspect the linkage of L2: its parent is L1 (sequential log linking)', async () => {
    expect(l1!.databaseBackupLsn).toBe(full!.checkpointLsn);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'A Full is run before L1 (a first Log would become a Full); parent id is read as LSN continuity in msdb.' });
  });
});
