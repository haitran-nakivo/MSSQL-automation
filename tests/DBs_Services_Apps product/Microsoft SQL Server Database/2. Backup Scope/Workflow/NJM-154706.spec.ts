import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154706: "[MSSQL-BK-WF-0005-2] Verify VDI Device Creation" (one VDI device per stream).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154706 with 3 concurrent streams (deleted in afterEach, backups kept); runs one Full backup.
// case-vs-ui: the SQL Server error log text "BACKUP DATABASE ... STRIPE ON DEVICE" is not read. The same facts come from msdb: the backup set lists 3 distinct device names (the VDI device GUIDs) on
//   virtual devices (device_type 7). A host with very few CPUs may cap the device count below 3.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154706');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO creates a separate VDI device for each of 3 backup streams', { tag: '@NJM-154706' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
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

  await test.step('3. Run a 3-stream SQL backup job: the multi-stream backup completes', async () => {
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo, options: { concurrentStreams: 3 } });
    jobCreated = true;
    expect(await chain.runAndWait()).toBe('successful');
  });

  await test.step('4. Check SQL Server for the backup command: 3 distinct VDI devices were used (read from msdb)', async () => {
    const sets = await msdb.since(mark.value);
    expect(sets).toHaveLength(1);
    const devices = await msdb.devices(sets[0].setId);
    testInfo.annotations.push({ type: 'observed-outcome', description: `Devices of the backup set: ${devices.join(' ; ')}` });
    expect(devices).toHaveLength(3);
    expect(new Set(devices).size).toBe(3);
    expect(sets[0].deviceType).toBe('7');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The SQL Server error log was not read; msdb.backupmediafamily shows the devices.' });
  });
});
