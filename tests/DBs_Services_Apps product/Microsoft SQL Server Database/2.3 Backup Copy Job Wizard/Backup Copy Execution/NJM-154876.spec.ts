import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-154876: "[MSSQL-BKC-0006] Verify Standalone Full Copy".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-154876-src (Full runs on the FULL-recovery database) and Backup Copy job NJM-154876; afterEach deletes both with their backups. Precondition: the target repository holds no backup of the database (else ABORTED).
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: "Configuration > Repositories" and "Activities page": the repository contents are read from Settings > Repositories > <repo> (UNVERIFIED) and the run result from the copy job page (status line and events); Activities was not used.
// case-vs-ui: the case says "create a Backup Copy job" from Data Protection > + (Create) > Backup Copy Job; the wizard step names follow the case folders, not an observed UI.
test.use(RUN_OPTIONS);

let copy: CopyFlows | undefined;
test.afterEach(async () => {
  try {
    await copy?.cleanup();
  } catch {
    /* best effort */
  }
  copy = undefined;
});

test(
  'NAKIVO Backup Copy copies a standalone Full recovery point as a self-contained Full',
  { tag: '@NJM-154876' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(1500000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupDatabase('INSTANCE', 'FULL');
    const primary = readBackupRepo('PRIMARY');
    const secondary = readBackupRepo('SECONDARY');
    const host = sqlHostFor(source);
    const srcJob = backupJobName('NJM-154876', '-src');
    const copyJob = backupJobName('NJM-154876');

    await test.step('1. Create a source backup with one Full and confirm the target is empty of it', async () => {
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) {
        throw new Error('ABORTED: the target repository ' + secondary + ' already holds a backup of ' + db + '; the case needs it empty of this backup (nothing of it is deleted automatically)');
      }
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, databases: [db], repo: primary, types: ['Full'] }, 300_000);
      expect(outcomes, 'every source backup run of ' + db + ' ends successfully').toEqual(['successful']);
      const sourceCounts = flow.typeCounts(await flow.repositoryTexts(primary));
      expect(sourceCounts.full, 'the source repository lists a Full recovery point').toBeGreaterThan(0);
    });

    await test.step('2. Create the Backup Copy job for the database', async () => {
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [db], destination: secondary });
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job ' + copyJob + ' is listed').toBe(true);
    });

    await test.step('3. Run the Backup Copy job and wait for it to finish', async () => {
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the Backup Copy job run ends successfully').toBe('successful');
    });

    await test.step('4. Open the target repository: the Full exists, type Full', async () => {
      const targetCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(targetCounts.full, 'the Full recovery point is on the target').toBeGreaterThan(0);
      expect(targetCounts.incremental + targetCounts.log, 'no other recovery point was required').toBe(0);
    });

    await test.step('5. The copied Full is self-contained', async () => {
      // "Restorable" is not provable in the UI without a restore; the check is that the chain is complete on the target and the run had no warning.
      note('observed-outcome', 'restorability of the copied recovery points was not exercised (no restore is run by this case)');
    });
  },
);
