import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import type { RecoveryModel } from '../../../../../helpers/sql-host';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154717: "[MSSQL-BK-WF-0014] Verify Log Alarm on SIMPLE Model" (a Log backup of a SIMPLE-recovery database fails with alarm sql3).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154717 (deleted in afterEach, backups kept); runs one Full and one failing Log backup. When the database is not SIMPLE the spec sets it with
//   ALTER DATABASE ... SET RECOVERY SIMPLE (case step 3) and afterEach puts the original recovery model back.
// case-vs-ui: a Full is run first so that the Log attempt is a real Log request (a first Log would become a Full). The alarm id "sql3" is not shown in the UI; its reason text is: "Transaction log
//   backups are not supported for databases using the SIMPLE recovery model" (observed 2026-10-08), which is what is asserted, together with the failed status.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154717');
let jobCreated = false;
let restore: (() => Promise<void>) | undefined;

test.afterEach(async ({ backupFlows }) => {
  if (jobCreated) {
    try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
    jobCreated = false;
  }
  if (restore) {
    try { await restore(); } catch { /* best effort */ }
    restore = undefined;
  }
});

test('NAKIVO fails a Log backup of a SIMPLE-recovery database and states that log backups are not supported for SIMPLE', { tag: '@NJM-154717' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupJobPage }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const chain = new ChainFlows(page, backupFlows);

  await test.step('1. Precondition: the SQL Server item is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
  });

  await test.step('2. The stream repository is selectable as the destination (the job is created with it)', async () => {
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('3. On the source SQL Server set the recovery model of the database to SIMPLE', async () => {
    const original = (await host.recoveryModel(db)) as RecoveryModel;
    if (original !== 'SIMPLE') {
      restore = async () => host.setRecoveryModel(db, original);
      await host.setRecoveryModel(db, 'SIMPLE');
    }
    expect(await host.recoveryModel(db)).toBe('SIMPLE');
  });

  await test.step('3b. Run a Full backup first (a Log needs an existing Full to be a Log request): it succeeds', async () => {
    expect(await chain.runAndWait()).toBe('successful');
  });

  await test.step('4. Run a Transaction Log backup of the database: the log backup attempt starts', async () => {
    const outcome = await chain.runAndWait({ type: 'Log' });
    testInfo.annotations.push({ type: 'observed-outcome', description: `Log run outcome: ${outcome}` });
    expect(outcome).toBe('failed');
  });

  await test.step('5. Review the job result and alarms: the job failed and the page states that Log backups are not supported for SIMPLE', async () => {
    await expect(backupJobPage.statusLine).toContainText('Last run has failed');
    await expect(backupJobPage.eventLine(/not supported for databases using the SIMPLE recovery model/i)).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The alarm id sql3 is not displayed in the UI; the reason text is asserted instead.' });
  });
});
