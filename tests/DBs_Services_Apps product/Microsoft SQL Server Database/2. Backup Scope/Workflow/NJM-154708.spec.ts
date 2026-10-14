import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { ChainFlows } from '../../../../../flows/bkA2-chain.flows';

// NJM-154708: "[MSSQL-BK-WF-0006] Verify Backup Transfer to Repo" (the backup is sent to the selected destination).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: creates the on-demand job NJM-154708 (deleted in afterEach, backups kept); runs one Full backup.
// case-vs-ui: the repository's backend path cannot be browsed from the tests. "Backup files appear in the target repository" is asserted as: the job page names the repository as its target and
//   Settings > Repositories > <repo> lists one backup for the job (UNVERIFIED navigation and list, see pages/bkA2-recovery.page.ts).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154708');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO sends the backup to the selected destination repository', { tag: '@NJM-154708' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const chain = new ChainFlows(page, backupFlows);

  await test.step('1. Precondition: the SQL Server item is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
  });

  await test.step('2. The stream repository is selectable as the destination (the job is created with it)', async () => {
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('3. Run the SQL backup job (Full): the job completes successfully', async () => {
    expect(await chain.runAndWait()).toBe('successful');
  });

  await test.step('4. The target repository holds the backup: the job page names it and the repository lists the job\'s backup', async () => {
    await expect(page.getByText(repo, { exact: false }).filter({ visible: true }).first()).toBeVisible();
    expect(await chain.repositoryBackupRowCount(repo, JOB)).toBeGreaterThanOrEqual(1);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The repository backend path is not browsed; the repository page list is used.' });
  });
});
