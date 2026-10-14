import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154707: "[MSSQL-BK-WF-0005-3] Verify Native Command Trigger" (the backup is a native SQL Server BACKUP DATABASE).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154707 (deleted in afterEach, backups kept); runs one Full backup.
// case-vs-ui: PARTIAL. No SQL Profiler / Extended Events trace is started (a trace session needs server permissions beyond the lab login and cannot be checked from the UI). The native command is
//   evidenced by msdb.backupset: the SQL engine itself recorded a Full (type D) backup set for the database during the run, written to a virtual device (device_type 7 = VDI), not a disk file.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154707');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO triggers the backup through the SQL Server native BACKUP DATABASE command (recorded by the engine on a virtual device)', { tag: '@NJM-154707' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const msdb = new MsdbChain(sqlHostFor(source), db);
  const chain = new ChainFlows(page, backupFlows);
  const mark = { value: 0 };

  await test.step('1. Precondition: the SQL Server item is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
  });

  await test.step('2. The stream repository is selectable as the destination (chosen in step 4); take the msdb watermark as the "trace" start', async () => {
    mark.value = await msdb.watermark();
  });

  await test.step('3. Trace: not started (see header); msdb is the record of what the engine executed', async () => {
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'No Profiler / Extended Events trace; msdb.backupset is used as the engine-side record.' });
  });

  await test.step('4. Run the SQL backup job (Full): the job runs and completes', async () => {
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
    expect(await chain.runAndWait()).toBe('successful');
  });

  await test.step('5. Review the engine record: a native Full backup (type D) of the database on a virtual device was executed', async () => {
    const sets = await msdb.since(mark.value);
    expect(sets).toHaveLength(1);
    expect(sets[0].type).toBe('D');
    expect(sets[0].deviceType).toBe('7');
  });
});
