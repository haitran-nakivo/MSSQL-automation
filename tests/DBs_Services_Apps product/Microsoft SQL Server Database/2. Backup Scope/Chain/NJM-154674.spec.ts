import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154674: "[MSSQL-BK-Chain-0001] Verify Logical Backup Chain Composition" (Full + Differential + Log form one logical chain).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154674 (deleted in afterEach, backups kept); runs one Full, one Differential and one Log backup.
// case-vs-ui: the UI shows no "chain identifier". The same logical chain is checked in msdb (external truth): the Differential's differential_base_guid is the Full's backup_set_uuid and the
//   Log's database_backup_lsn is the Full's checkpoint_lsn. The repository's recovery points are read (UNVERIFIED locators) and recorded as observed-outcome.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154674');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO links a Full, a Differential and a Log backup of one database into the same logical backup chain', { tag: '@NJM-154674' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
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

  await test.step('3. Run a Full backup: a Full recovery point is created', async () => {
    expect(await chain.runAndWait()).toBe('successful');
  });

  await test.step('4. Run a Differential backup: a Differential recovery point is created', async () => {
    expect(await chain.runAndWait({ type: 'Differential' })).toBe('successful');
  });

  await test.step('5. Run a Transaction Log backup: a Log recovery point is created', async () => {
    expect(await chain.runAndWait({ type: 'Log' })).toBe('successful');
  });

  await test.step('6. Inspect the three backups: they belong to the same logical chain', async () => {
    const sets = await msdb.since(mark.value);
    expect(sets.map((b) => b.type)).toEqual(['D', 'I', 'L']);
    const [full, diff, log] = sets;
    expect(diff.differentialBaseGuid, 'the Differential is not based on the Full').toBe(full.uuid);
    expect(log.databaseBackupLsn, 'the Log is not based on the Full checkpoint').toBe(full.checkpointLsn);
    try {
      const texts = await chain.readRepositoryTexts(repo);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Repository page texts (UNVERIFIED navigation): ${texts.slice(0, 80).join(' | ')}` });
    } catch (error) {
      testInfo.annotations.push({ type: 'observed-outcome', description: `Repository page could not be read with the UNVERIFIED locators: ${String(error).slice(0, 200)}` });
    }
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The UI shows no chain id; the common chain is verified through msdb LSN / GUID links.' });
  });
});
