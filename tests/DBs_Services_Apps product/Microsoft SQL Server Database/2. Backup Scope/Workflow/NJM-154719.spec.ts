import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { ChainFlows } from '../../../../../flows/bkA2-chain.flows';

// NJM-154719: "[MSSQL-BK-WF-0016] Verify Repository Status Update" (the new recovery point shows in the repository right after the run).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: creates the on-demand job NJM-154719 (deleted in afterEach, backups kept); runs one Full backup.
// case-vs-ui: UNVERIFIED navigation: Settings > Repositories > <repo> with its Backups list (notes: columns Name, Encryption, Password, Job, Size). "Repository status is updated" is asserted as: the
//   list gains a backup row for the job straight after the run ended, and the repository page text is recorded (observed-outcome) for the owner to compare with the status line.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154719');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO shows the new recovery point in the repository immediately after a successful Full backup', { tag: '@NJM-154719' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
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

  await test.step('Ad hoc (negative): before the run the repository holds no backup of this job', async () => {
    expect(await chain.repositoryBackupRowCount(repo, JOB)).toBe(0);
    await backupFlows.openJob(JOB);
  });

  await test.step('3. Run the SQL backup job (Full): the job completes successfully', async () => {
    expect(await chain.runAndWait()).toBe('successful');
  });

  await test.step('4. Immediately open the repository view: the new recovery point appears and the repository is listed', async () => {
    const rows = await chain.repositoryBackupRowCount(repo, JOB);
    expect(rows, 'the repository does not list a backup of the job right after the run').toBeGreaterThanOrEqual(1);
    const texts = await backupFlows.visibleTexts();
    testInfo.annotations.push({ type: 'observed-outcome', description: `Repository page texts: ${texts.slice(0, 80).join(' | ')}` });
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Case: repository view / recovery points list. UI: Settings > Repositories > repository > Backups (UNVERIFIED).' });
  });
});
