import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154711: "[MSSQL-BK-WF-0008] Verify Diff Linking" (a Differential is linked to the latest Full of its chain).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154711 (deleted in afterEach, backups kept); runs a Full, a Differential and (ad hoc) a second Differential.
// case-vs-ui: the UI does not show the parent Full id of a Differential. The link is read from msdb: the Differential's differential_base_guid points to the Full (its backup_set_uuid).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154711');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO links a Differential backup to the Full backup it was taken after', { tag: '@NJM-154711' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const msdb = new MsdbChain(sqlHostFor(source), db);
  const chain = new ChainFlows(page, backupFlows);
  let full: Awaited<ReturnType<ChainFlows['runStep']>>['backups'][number] | undefined;

  await test.step('1. Precondition: the SQL Server item is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
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

  await test.step('4. Run a Differential backup: a Differential recovery point is created', async () => {
    const { outcome, backups } = await chain.runStep(msdb, { type: 'Differential' });
    expect(outcome).toBe('successful');
    expect(backups.map((b) => b.type)).toEqual(['I']);
    testInfo.annotations.push({ type: 'observed-outcome', description: `Differential base guid ${backups[0].differentialBaseGuid}; Full uuid ${full!.uuid}` });
    expect(backups[0].differentialBaseGuid, 'the Differential does not reference its parent Full').toBe(full!.uuid);
  });

  await test.step('5. Inspect the Differential\'s linkage: it references the specific parent Full (and so does a second Differential, still the same Full)', async () => {
    const { outcome, backups } = await chain.runStep(msdb, { type: 'Differential' });
    expect(outcome).toBe('successful');
    expect(backups[0].differentialBaseGuid).toBe(full!.uuid);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The parent Full id is read from msdb; the UI does not show it.' });
  });
});
