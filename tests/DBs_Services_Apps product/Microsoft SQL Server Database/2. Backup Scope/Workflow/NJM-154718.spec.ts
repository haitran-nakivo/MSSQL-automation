import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154718: "[MSSQL-BK-WF-0015] Verify Log Alarm on No Full" (a first Log backup on an empty chain).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the job NJM-154718 with one weekly schedule of SQL backup type Log (deleted in afterEach, backups kept); runs it once through the Run dialog.
// case-vs-ui (CONTRADICTION): the case expects the Log to FAIL with alarm sql3 because no Full exists. Observed 2026-10-08 (and the newer spec NJM-175281): the product performs a Full instead and the job
//   succeeds; no db0001 notification was seen and sql3 is only raised for the SIMPLE model. The spec asserts the observed behaviour. The first run is started with "Select schedule" in the Run
//   dialog so that the schedule's type (Log) applies; that control is UNVERIFIED (notes: "Select schedule" combo). Same scenario as NJM-154697 (kept as a separate case key).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154718');
const SCHEDULE = 'NJM-154718-log';
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO runs a Full instead of failing with sql3 when the first Log backup finds no Full in the chain', { tag: '@NJM-154718' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupJobPage }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const msdb = new MsdbChain(host, db);
  const chain = new ChainFlows(page, backupFlows);
  let produced: Awaited<ReturnType<ChainFlows['runStep']>>;

  await test.step('1. Precondition: the SQL Server item is in Inventory and the database is in FULL recovery model', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
    const model = await host.recoveryModel(db);
    if (model !== 'FULL') throw new Error(`ABORTED: database ${db} is in ${model || 'an unknown'} recovery model, the case needs FULL`);
  });

  await test.step('2. The stream repository is selectable as the destination (the job is created with it)', async () => {
    // Step 3 of the case: a new job with an empty chain; its only schedule is of SQL backup type Log.
    await chain.createJob({
      name: JOB,
      item: source.item,
      databases: [db],
      repo,
      schedules: [{ name: SCHEDULE, type: 'Weekly', sqlBackupType: 'Log', keepFor: { count: 10 } }],
    });
    jobCreated = true;
  });

  await test.step('3. The new job exists with an empty chain: it has never run', async () => {
    await expect(backupJobPage.runButton).toBeVisible();
    await expect(page.getByText(/Last run (was|has)/).filter({ visible: true })).toHaveCount(0);
  });

  await test.step('4. Force a Log backup as the first run (Run dialog, Select schedule): the run starts', async () => {
    produced = await chain.runStep(msdb, { schedule: SCHEDULE });
    expect(['successful', 'failed', 'warning']).toContain(produced.outcome);
  });

  await test.step('5. Review the job result and alarms: observed, the job succeeds and the produced recovery point is a Full (no sql3)', async () => {
    expect(produced.outcome).toBe('successful');
    expect(produced.backups.map((b) => b.type)).toEqual(['D']);
    const texts = (await backupFlows.visibleTexts()).filter((t) => /sql3|Transaction log|Before you try to back up the transaction log/i.test(t));
    expect(texts, 'unexpected sql3-style text on the job page').toEqual([]);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Case expects failure with sql3; observed: a Full is performed and the job succeeds (no db0001 notification seen).' });
  });
});
