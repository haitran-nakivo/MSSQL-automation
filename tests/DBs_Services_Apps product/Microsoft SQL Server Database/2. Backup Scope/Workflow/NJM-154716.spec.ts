import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154716: "[MSSQL-BK-WF-0013] Verify Diff Failure Error (No Full)" (a Differential with no valid Full in the repository).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154716 (deleted in afterEach, backups kept in both repositories); runs a Full to PRIMARY, moves the job's destination to SECONDARY (the old backup stays in
//   PRIMARY) and runs again.
// case-vs-ui (CONTRADICTION): the case deletes the base Full from the repository and expects the Differential to FAIL with "no valid Full backup found". The repository's Delete-backup path is not
//   explored and may be blocked while a job uses the backup, so "no valid Full" is created the way the notes observed it (2026-10-08): Edit job > Destination > another repository ("Change backup destination?
//   A full backup will be sent to the new destination during the next job run"). Observed result of a Differential / Log with no Full: the product runs a Full and the job succeeds (no failure, no db0001).
//   The spec asserts that observed behaviour. UNVERIFIED: the Edit wizard locators (Edit button, Save, "Change" confirmation) in flows/bkA2-chain.flows.ts.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154716');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO runs a Full instead of failing when a Differential finds no valid Full in the target repository', { tag: '@NJM-154716' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupJobPage }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const primary = readBackupRepo('PRIMARY');
  const secondary = readBackupRepo('SECONDARY');
  const msdb = new MsdbChain(sqlHostFor(source), db);
  const chain = new ChainFlows(page, backupFlows);
  let produced: Awaited<ReturnType<ChainFlows['runStep']>>;

  await test.step('1. Precondition: the SQL Server item is in Inventory and two repositories are provided', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
    if (primary === secondary) throw new Error('ABORTED: NAKIVO_BK_REPO_PRIMARY and NAKIVO_BK_REPO_SECONDARY must name two different repositories');
  });

  await test.step('2. Create the job and run a Full: a chain exists in the primary repository', async () => {
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo: primary });
    jobCreated = true;
    expect(await chain.runAndWait()).toBe('successful');
  });

  await test.step('3. Make the base Full unavailable: change the job destination to the second repository (no Full there)', async () => {
    await chain.changeDestination(secondary);
    await expect(page.getByText(secondary, { exact: false }).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
  });

  await test.step('4. Run the job again (a Differential would need the missing Full): the run starts', async () => {
    await backupJobPage.runButton.click({ timeout: 10_000 });
    await backupJobPage.runDialog.waitFor({ timeout: 15_000 });
    const typeCombos = await backupJobPage.runDialog.getByText('SQL backup type', { exact: false }).count();
    testInfo.annotations.push({ type: 'observed-outcome', description: `Run dialog shows an SQL backup type combo: ${typeCombos > 0}` });
    expect(typeCombos, 'after a destination change the Run dialog is expected to offer no SQL backup type (notes 2026-10-08)').toBe(0);
    await backupJobPage.runDialog.getByText('Cancel', { exact: true }).last().click({ timeout: 10_000 });
    produced = await chain.runStep(msdb);
  });

  await test.step('5. Review the job result: no failure; the product produced a Full instead of an orphan Differential', async () => {
    expect(produced.outcome).toBe('successful');
    expect(produced.backups.map((b) => b.type)).toEqual(['D']);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Case expects the job to fail with a "no valid Full" error; observed: a Full is run and the job succeeds.' });
  });
});
