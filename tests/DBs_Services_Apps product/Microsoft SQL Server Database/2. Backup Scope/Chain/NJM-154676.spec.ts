import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154676: "[MSSQL-BK-Chain-0003] Verify Sequence Storage in Repository" (Full -> L1 -> L2 keep their order).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154676 (deleted in afterEach, backups kept); runs one Full and two Log backups.
// case-vs-ui: the repository metadata is not shown by the UI. The dependency L2 -> L1 -> Full is checked in msdb (external truth): both logs are based on the Full's checkpoint and L2 starts
//   at or before L1's last LSN (no gap). The repository page is read as observed-outcome (UNVERIFIED navigation).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154676');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO stores the sequence Full, Log 1, Log 2 in order with each Log depending on the previous one', { tag: '@NJM-154676' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(1_200_000);
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

  await test.step('3. Create the sequence Full, L1, L2: three recovery points are created in order', async () => {
    expect(await chain.runAndWait()).toBe('successful');
    expect(await chain.runAndWait({ type: 'Log' })).toBe('successful');
    expect(await chain.runAndWait({ type: 'Log' })).toBe('successful');
    const sets = await msdb.since(mark.value);
    expect(sets.map((b) => b.type)).toEqual(['D', 'L', 'L']);
    expect(sets[0].setId).toBeLessThan(sets[1].setId);
    expect(sets[1].setId).toBeLessThan(sets[2].setId);
  });

  await test.step('4. Inspect the dependencies: L2 depends on L1 and L1 depends on the Full', async () => {
    const [full, l1, l2] = await msdb.since(mark.value);
    expect(l1.databaseBackupLsn, 'L1 is not based on the Full').toBe(full.checkpointLsn);
    expect(l2.databaseBackupLsn, 'L2 is not based on the Full chain').toBe(full.checkpointLsn);
    expect(BigInt(l2.firstLsn) <= BigInt(l1.lastLsn), 'L2 does not continue from L1').toBe(true);
    expect(BigInt(l1.firstLsn) <= BigInt(full.lastLsn), 'L1 does not continue from the Full').toBe(true);
    try {
      const texts = await chain.readRepositoryTexts(repo);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Repository page texts (UNVERIFIED navigation): ${texts.slice(0, 80).join(' | ')}` });
    } catch (error) {
      testInfo.annotations.push({ type: 'observed-outcome', description: `Repository page could not be read with the UNVERIFIED locators: ${String(error).slice(0, 200)}` });
    }
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Repository dependency metadata is not shown in the UI; verified through msdb.' });
  });
});
