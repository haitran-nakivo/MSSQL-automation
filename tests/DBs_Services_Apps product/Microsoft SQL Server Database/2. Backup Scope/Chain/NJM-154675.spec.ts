import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154675: "[MSSQL-BK-Chain-0002] Verify Spanning Across Backup Files" (one Full and 50 Log backups on the same chain).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154675 (deleted in afterEach, backups kept); runs one Full and 50 Log backups (about 20 to 70 s each: expect up to an hour).
// case-vs-ui: the repository's backend storage path (the physical files) is not reachable from the UI or from msdb, so "multiple physical files exist" is NOT asserted; what is asserted is
//   the part the case controls: 50 Log points on the one chain (msdb: each Log based on the same Full, no gap between consecutive logs). The repository page is read as observed-outcome (UNVERIFIED).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154675');
const LOG_RUNS = 50;
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO keeps 50 consecutive Log backups on the same chain as their Full', { tag: '@NJM-154675' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(6_000_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const msdb = new MsdbChain(host, db);
  const chain = new ChainFlows(page, backupFlows);
  const mark = { value: 0 };

  await test.step('1. Precondition: the SQL Server item is in Inventory and the database is in FULL recovery model', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
    const model = await host.recoveryModel(db);
    if (model !== 'FULL') throw new Error(`ABORTED: database ${db} is in ${model || 'an unknown'} recovery model, the case needs FULL`);
  });

  await test.step('2. The stream repository is selectable as the destination (the job is created with it)', async () => {
    mark.value = await msdb.watermark();
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('3. Run a Full backup: a Full recovery point is created for the chain', async () => {
    expect(await chain.runAndWait()).toBe('successful');
  });

  await test.step(`4. Run ${LOG_RUNS} Log backups on the same chain: ${LOG_RUNS} Log recovery points are created`, async () => {
    for (let i = 1; i <= LOG_RUNS; i++) {
      const outcome = await chain.runAndWait({ type: 'Log' });
      expect(outcome, `Log run ${i} did not succeed`).toBe('successful');
    }
    const sets = await msdb.since(mark.value);
    expect(sets.filter((b) => b.type === 'D')).toHaveLength(1);
    const logs = sets.filter((b) => b.type === 'L');
    expect(logs).toHaveLength(LOG_RUNS);
    const full = sets.find((b) => b.type === 'D')!;
    for (const [index, log] of logs.entries()) {
      expect(log.databaseBackupLsn, `Log ${index + 1} is not based on the Full`).toBe(full.checkpointLsn);
      if (index > 0) expect(BigInt(log.firstLsn) <= BigInt(logs[index - 1].lastLsn), `gap between Log ${index} and Log ${index + 1}`).toBe(true);
    }
  });

  await test.step('5. Inspect the repository for this chain (backend files are not reachable; the repository page is recorded)', async () => {
    try {
      const texts = await chain.readRepositoryTexts(repo);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Repository page texts (UNVERIFIED navigation): ${texts.slice(0, 80).join(' | ')}` });
    } catch (error) {
      testInfo.annotations.push({ type: 'observed-outcome', description: `Repository page could not be read with the UNVERIFIED locators: ${String(error).slice(0, 200)}` });
    }
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Physical backup files on the repository path cannot be inspected through the UI; not asserted.' });
  });
});
