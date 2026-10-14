import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154710: "[MSSQL-BK-WF-0007] Verify New Chain on Full" (a new Full starts a new chain).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154710 (deleted in afterEach, backups kept); runs two Full backups and, as an ad hoc step, one Differential.
// case-vs-ui: the UI shows no chain id. A chain is identified in msdb by its Full (backup_set_uuid / checkpoint_lsn): the second Full has a different uuid and checkpoint, and a Differential taken after it
//   is based on the second Full, not on the first. The second Full is requested in the Run dialog (SQL backup type = Full; the combo appears after the first run and defaults to Log).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154710');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO starts a new, distinct backup chain with every new Full backup', { tag: '@NJM-154710' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const msdb = new MsdbChain(sqlHostFor(source), db);
  const chain = new ChainFlows(page, backupFlows);
  let fullA: { uuid: string; checkpointLsn: string } | undefined;
  let fullB: { uuid: string; checkpointLsn: string } | undefined;

  await test.step('1. Precondition: the SQL Server item is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
  });

  await test.step('2. The stream repository is selectable as the destination (the job is created with it)', async () => {
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('3. Run a Full backup (chain A): a Full recovery point is created', async () => {
    const { outcome, backups } = await chain.runStep(msdb);
    expect(outcome).toBe('successful');
    expect(backups.map((b) => b.type)).toEqual(['D']);
    fullA = backups[0];
  });

  await test.step('4. Run another Full backup of the same database (chain B): a second Full recovery point is created', async () => {
    const { outcome, backups } = await chain.runStep(msdb, { type: 'Full' });
    expect(outcome).toBe('successful');
    expect(backups.map((b) => b.type)).toEqual(['D']);
    fullB = backups[0];
  });

  await test.step('5. Compare the chains of the two Fulls: the second Full starts a new, distinct chain', async () => {
    expect(fullB!.uuid).not.toBe(fullA!.uuid);
    expect(fullB!.checkpointLsn).not.toBe(fullA!.checkpointLsn);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'No chain id in the UI; chain identity is the Full (uuid / checkpoint LSN) in msdb.' });
  });

  await test.step('Ad hoc: a Differential after the second Full is based on the second Full', async () => {
    const { outcome, backups } = await chain.runStep(msdb, { type: 'Differential' });
    expect(outcome).toBe('successful');
    expect(backups.map((b) => b.type)).toEqual(['I']);
    expect(backups[0].differentialBaseGuid).toBe(fullB!.uuid);
    expect(backups[0].differentialBaseGuid).not.toBe(fullA!.uuid);
  });
});
