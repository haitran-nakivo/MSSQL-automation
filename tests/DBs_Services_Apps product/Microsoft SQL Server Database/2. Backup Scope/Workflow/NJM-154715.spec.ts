import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154715: "[MSSQL-BK-WF-0012] Verify Unique Chain ID Allocation" (every Full backup gets its own chain id; two separate Full backup jobs).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand jobs NJM-154715 and NJM-154715-2 for the same database (both deleted in afterEach, backups kept); each runs one Full backup.
// case-vs-ui: the UI shows no chain id; a chain is identified by its Full in msdb (backup_set_uuid and checkpoint_lsn), and these differ between the two jobs' Full backups.
test.use(RUN_OPTIONS);

const JOB_1 = backupJobName('NJM-154715');
const JOB_2 = backupJobName('NJM-154715', '-2');
const created = new Set<string>();

test.afterEach(async ({ backupFlows }) => {
  for (const name of created) {
    try { await backupFlows.discardJobIfPresent(name); } catch { /* best effort */ }
  }
  created.clear();
});

test('NAKIVO allocates a unique chain to the Full backups of two separate jobs of the same database', { tag: '@NJM-154715' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const msdb = new MsdbChain(sqlHostFor(source), db);
  const chain = new ChainFlows(page, backupFlows);
  let first: Awaited<ReturnType<ChainFlows['runStep']>>['backups'][number] | undefined;
  let second: typeof first;

  await test.step('1. Precondition: the SQL Server item is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
  });

  await test.step('2. The stream repository is selectable as the destination (both jobs are created with it)', async () => {
    await chain.createJob({ name: JOB_1, item: source.item, databases: [db], repo });
    created.add(JOB_1);
  });

  await test.step('3. Run the first Full backup job: the first Full with its chain is created', async () => {
    const { outcome, backups } = await chain.runStep(msdb);
    expect(outcome).toBe('successful');
    expect(backups.map((b) => b.type)).toEqual(['D']);
    first = backups[0];
  });

  await test.step('4. Run a second, separate Full backup job for the database: the second Full with its chain is created', async () => {
    await chain.createJob({ name: JOB_2, item: source.item, databases: [db], repo });
    created.add(JOB_2);
    const { outcome, backups } = await chain.runStep(msdb);
    expect(outcome).toBe('successful');
    expect(backups.map((b) => b.type)).toEqual(['D']);
    second = backups[0];
  });

  await test.step('5. Compare the two chains: they are unique', async () => {
    expect(second!.uuid).not.toBe(first!.uuid);
    expect(second!.checkpointLsn).not.toBe(first!.checkpointLsn);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'No chain id in the UI; chain identity is the Full (uuid / checkpoint LSN) in msdb.' });
  });
});
