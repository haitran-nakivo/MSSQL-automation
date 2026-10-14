import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { ChainFlows } from '../../../../../flows/bkA2-chain.flows';

// NJM-154678: "[MSSQL-BK-Chain-0005] Verify Abstraction of Backup Files" (the UI hides the physical files).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: creates the on-demand job NJM-154678 (deleted in afterEach, backups kept); runs one Full backup.
// case-vs-ui: "Configuration > Repositories" is Settings > Repositories in the UI. UNVERIFIED: navigation and the Backups list (notes: columns Name, Encryption, Password, Job, Size). The case's
//   "single logical backup object per database" is asserted as: exactly one backup row of the job in the repository list and no physical file names (.bak, .trn, .dif) anywhere on the repository page.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154678');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO shows one logical backup object for the database in the repository, not the physical files', { tag: '@NJM-154678' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const chain = new ChainFlows(page, backupFlows);
  let texts: string[] = [];

  await test.step('1. Precondition: the SQL Server item is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
  });

  await test.step('2. The stream repository is selectable as the destination (the job is created with it)', async () => {
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('3. Run one SQL backup: a recovery point exists in the repository', async () => {
    expect(await chain.runAndWait()).toBe('successful');
  });

  await test.step('4. Open Settings > Repositories and the repository holding the backup: its contents are displayed', async () => {
    texts = await chain.readRepositoryTexts(repo);
    expect(texts.length).toBeGreaterThan(0);
  });

  await test.step('5. View the backup entry: one logical backup object for the job / database, no raw list of physical files', async () => {
    expect(await chain.repositoryBackupRowCount(repo, JOB)).toBe(1);
    expect(texts.join(' ')).not.toMatch(/\.(bak|trn|dif|vbk|vib)\b/i);
  });
});
