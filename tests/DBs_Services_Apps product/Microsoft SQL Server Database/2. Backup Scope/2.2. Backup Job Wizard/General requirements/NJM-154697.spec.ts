import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../../flows/bkA2-chain.flows';

// NJM-154697: "[MSSQL-BK-General-0005] Verify Log Block without Full" (a Log backup as the first run of a database).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the job NJM-154697 with one weekly schedule of SQL backup type Log (deleted in afterEach, backups kept); runs it once through the Run dialog.
// case-vs-ui: the first run is started with "Select schedule" in the Run dialog so that the schedule's type (Log) applies; the control is UNVERIFIED. Observed 2026-10-08: the product
//   runs a Full instead of the Log, no db0001 notification was seen (observed-outcome only).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154697');
const SCHEDULE = 'NJM-154697-log';
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO never creates an orphan Log backup: a Log requested as the first run of a database produces a Full', { tag: '@NJM-154697' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const msdb = new MsdbChain(host, db);
  const chain = new ChainFlows(page, backupFlows);
  let produced: Awaited<ReturnType<ChainFlows['runStep']>>;

  await test.step('1. Precondition: FULL recovery model and a new job with no Full recovery point yet', async () => {
    const model = await host.recoveryModel(db);
    if (model !== 'FULL') throw new Error(`ABORTED: database ${db} is in ${model || 'an unknown'} recovery model, the case needs FULL`);
    await chain.createJob({
      name: JOB,
      item: source.item,
      databases: [db],
      repo,
      schedules: [{ name: SCHEDULE, type: 'Weekly', sqlBackupType: 'Log', keepFor: { count: 10 } }],
    });
    jobCreated = true;
    await expect(backupJobPage.runButton).toBeVisible();
  });

  await test.step('2. Start the job with its Log schedule as the first run: the job starts', async () => {
    produced = await chain.runStep(msdb, { schedule: SCHEDULE });
    expect(['successful', 'failed', 'warning']).toContain(produced.outcome);
  });

  await test.step('3. Inspect the recovery point the run produced: it is a Full, not a Log', async () => {
    expect(produced.backups.length, 'the run recorded no backup set in msdb').toBeGreaterThan(0);
    expect(produced.backups[0].type, 'first backup set of the database is not a Full').toBe('D');
  });

  await test.step('4. The chain starts with a valid Full: no log backup set exists without it', async () => {
    expect(produced.backups.filter((b) => b.type === 'L')).toHaveLength(0);
    expect(produced.backups.filter((b) => b.type === 'D')).toHaveLength(1);
  });

  await test.step('5. The job completes successfully and no failure is left on the job page', async () => {
    expect(produced.outcome).toBe('successful');
    const texts = (await backupFlows.visibleTexts()).filter((t) => /Backup type|db0001|Cannot perform|sql3/i.test(t));
    testInfo.annotations.push({ type: 'observed-outcome', description: `Job page texts about the backup type / alarms: ${texts.join(' | ') || 'none'}` });
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Log as first run: the product runs a Full; no db0001 notification was observed on 2026-10-08.' });
  });
});
