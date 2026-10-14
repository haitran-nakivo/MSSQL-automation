import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154705: "[MSSQL-BK-WF-0005-1] Verify Parallel Backup Support" (3 data streams: the database is backed up in parallel stripes).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154705 with "Limit data backup to 3 concurrent streams" (deleted in afterEach, backups kept); runs one Full backup.
// case-vs-ui: the SQL Server error log is not read. The parallel VDI stripes are read from msdb: the backup set has 3 media families (backupmediafamily rows) on virtual devices (device_type 7).
//   The notes (2026-10-08) saw 64 streams -> 8 devices on a 4-CPU host, so a host with very few CPUs may cap the count below 3 (then this spec fails and the host needs checking).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154705');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO backs up one database in 3 parallel VDI stripes when 3 data streams are set', { tag: '@NJM-154705' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
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

  await test.step('2. The stream repository is selectable as the destination (chosen in step 3); take the msdb watermark', async () => {
    mark.value = await msdb.watermark();
  });

  await test.step('3. Create the job with Options > data streams = 3 (up to 64 allowed)', async () => {
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo, options: { concurrentStreams: 3 } });
    jobCreated = true;
  });

  await test.step('4. Finish and run the job: the multi-stream backup job runs and ends successfully', async () => {
    expect(await chain.runAndWait()).toBe('successful');
  });

  await test.step('5. Inspect SQL Server (msdb) for the backup: parallel VDI stripes (3 devices) were used', async () => {
    const sets = await msdb.since(mark.value);
    expect(sets.map((b) => b.type)).toEqual(['D']);
    testInfo.annotations.push({ type: 'observed-outcome', description: `media families=${sets[0].mediaFamilies}, device_type=${sets[0].deviceType}` });
    expect(sets[0].mediaFamilies).toBe(3);
    expect(sets[0].deviceType).toBe('7');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'SQL Server error log not read; stripes are read from msdb.backupmediafamily.' });
  });
});
