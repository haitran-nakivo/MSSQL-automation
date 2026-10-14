import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../../flows/bkA2-chain.flows';

// NJM-154696: "[MSSQL-BK-General-0004] Verify Diff Block without Full" (a Differential as the first run of a database).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the job NJM-154696 with one weekly schedule of SQL backup type Differential (deleted in afterEach, backups kept); runs it once through the Run dialog.
// "No Full yet" holds because the job is new (its backup in the repository is new): the first run of a job never has a Full to link to.
// case-vs-ui: the first run is started with "Select schedule" in the Run dialog so that the schedule's type (Differential) applies; the control is UNVERIFIED (notes: "Select schedule" combo).
//   Observed 2026-10-08: the product runs a Full instead; the db0001 notification of the newer spec was not seen, so no notification is asserted (observed-outcome only).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154696');
const SCHEDULE = 'NJM-154696-diff';
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO never creates an orphan Differential: a Differential requested as the first run of a database produces a Full', { tag: '@NJM-154696' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const msdb = new MsdbChain(sqlHostFor(source), db);
  const chain = new ChainFlows(page, backupFlows);
  let produced: Awaited<ReturnType<ChainFlows['runStep']>>;

  await test.step('1. Precondition: a new job (a new backup in the repository) holds no Full recovery point yet', async () => {
    await chain.createJob({
      name: JOB,
      item: source.item,
      databases: [db],
      repo,
      schedules: [{ name: SCHEDULE, type: 'Weekly', sqlBackupType: 'Differential', keepFor: { count: 10 } }],
    });
    jobCreated = true;
    await expect(backupJobPage.runButton).toBeVisible();
  });

  await test.step('2. Start the job with its Differential schedule as the first run: the job starts', async () => {
    produced = await chain.runStep(msdb, { schedule: SCHEDULE });
    expect(['successful', 'failed', 'warning']).toContain(produced.outcome);
  });

  await test.step('3. Inspect the recovery point the run produced: it is a Full (the Differential was not stored without a parent)', async () => {
    expect(produced.backups.length, 'the run recorded no backup set in msdb').toBeGreaterThan(0);
    expect(produced.backups[0].type, 'first backup set of the database is not a Full').toBe('D');
  });

  await test.step('4. The chain starts with a valid Full: no differential backup set exists without it', async () => {
    expect(produced.backups.filter((b) => b.type === 'I')).toHaveLength(0);
    expect(produced.backups.filter((b) => b.type === 'D')).toHaveLength(1);
  });

  await test.step('5. The job completes successfully and no failure is left on the job page', async () => {
    expect(produced.outcome).toBe('successful');
    const texts = (await backupFlows.visibleTexts()).filter((t) => /Backup type|db0001|Cannot perform/i.test(t));
    testInfo.annotations.push({ type: 'observed-outcome', description: `Job page texts about the backup type / notification: ${texts.join(' | ') || 'none'}` });
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Differential as first run: the product runs a Full; no db0001 notification was observed on 2026-10-08.' });
  });
});
