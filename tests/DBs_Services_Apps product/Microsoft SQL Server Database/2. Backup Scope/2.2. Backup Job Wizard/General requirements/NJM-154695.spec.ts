import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../../flows/bkA2-chain.flows';

// NJM-154695: "[MSSQL-BK-General-0003] Verify Dependency Metadata" (Full -> Differential -> Log are linked).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (a database in FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154695 (deleted in afterEach, backups kept); runs one Full, one Differential and one Log backup of the database.
// case-vs-ui: the 11.2.1 UI shows no "dependency metadata" of a recovery point. The links are checked in msdb.backupset on the source server (the external truth): the Differential's
//   differential_base_guid is the Full's backup_set_uuid, the Log's database_backup_lsn is the Full's checkpoint_lsn. The recovery-point picker is only read (observed-outcome).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154695');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO links a Differential to its Full and a Log to the Full in the backup chain of a FULL-recovery database', { tag: '@NJM-154695' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const msdb = new MsdbChain(host, db);
  const chain = new ChainFlows(page, backupFlows);
  const rows: Record<string, { uuid: string; checkpointLsn: string; baseGuid: string; dbLsn: string; lastLsn: string }> = {};

  await test.step('1. Precondition: the database is in FULL recovery model and the repository is selectable', async () => {
    const model = await host.recoveryModel(db);
    if (model !== 'FULL') throw new Error(`ABORTED: database ${db} is in ${model || 'an unknown'} recovery model, the case needs FULL`);
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('2. Run the job: a Full recovery point is created', async () => {
    const { outcome, backups } = await chain.runStep(msdb);
    expect(outcome).toBe('successful');
    const full = backups.find((b) => b.type === 'D');
    expect(full, 'no Full (type D) backup set was recorded in msdb').toBeTruthy();
    rows.full = { uuid: full!.uuid, checkpointLsn: full!.checkpointLsn, baseGuid: '', dbLsn: full!.databaseBackupLsn, lastLsn: full!.lastLsn };
  });

  await test.step('3. Run the job again as Differential: a Differential recovery point is created after the Full', async () => {
    const { outcome, backups } = await chain.runStep(msdb, { type: 'Differential' });
    expect(outcome).toBe('successful');
    const diff = backups.find((b) => b.type === 'I');
    expect(diff, 'no Differential (type I) backup set was recorded in msdb').toBeTruthy();
    rows.diff = { uuid: diff!.uuid, checkpointLsn: diff!.checkpointLsn, baseGuid: diff!.differentialBaseGuid, dbLsn: diff!.databaseBackupLsn, lastLsn: diff!.lastLsn };
  });

  await test.step('4. Run the job again as Log: a Log recovery point is created after the Differential', async () => {
    const { outcome, backups } = await chain.runStep(msdb, { type: 'Log' });
    expect(outcome).toBe('successful');
    const log = backups.find((b) => b.type === 'L');
    expect(log, 'no Log (type L) backup set was recorded in msdb').toBeTruthy();
    rows.log = { uuid: log!.uuid, checkpointLsn: log!.checkpointLsn, baseGuid: '', dbLsn: log!.databaseBackupLsn, lastLsn: log!.lastLsn };
  });

  await test.step('5. Open the recovery points of the job and read what is shown (UNVERIFIED locators: recorded as observed-outcome, not asserted)', async () => {
    try {
      const texts = await chain.openRecoveryPicker();
      testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery picker texts: ${texts.slice(0, 80).join(' | ')}` });
    } catch (error) {
      testInfo.annotations.push({ type: 'observed-outcome', description: `The recovery-point picker could not be opened with the UNVERIFIED locators: ${String(error).slice(0, 200)}` });
    }
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'No dependency metadata is shown in the UI; links verified in msdb.' });
  });

  await test.step('6. The recorded dependencies match the backup order Full -> Differential -> Log', async () => {
    expect(rows.diff.baseGuid, 'the Differential does not reference the Full').toBe(rows.full.uuid);
    expect(rows.log.dbLsn, 'the Log does not reference the Full checkpoint').toBe(rows.full.checkpointLsn);
    expect(BigInt(rows.diff.lastLsn) >= BigInt(rows.full.lastLsn)).toBe(true);
    expect(BigInt(rows.log.lastLsn) >= BigInt(rows.diff.lastLsn)).toBe(true);
  });
});
