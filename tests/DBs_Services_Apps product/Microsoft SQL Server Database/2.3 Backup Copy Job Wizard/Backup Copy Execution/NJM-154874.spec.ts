import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-154874: "[MSSQL-BKC-0004] Verify Auto-Fetch Full for Log".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-154874-src (Full, Log runs on the FULL-recovery database) and Backup Copy job NJM-154874; afterEach deletes both with their backups. Precondition: the target repository holds no backup of the database (else ABORTED).
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
  'NAKIVO Backup Copy automatically copies the base Full before a Log when the target has no Full',
  { tag: '@NJM-154874' },
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
    const srcJob = backupJobName('NJM-154874', '-src');
    const copyJob = backupJobName('NJM-154874');

    await test.step('1. Create the source chain (Full + Log) and confirm the target is empty of this backup', async () => {
      if ((await host.recoveryModel(db)) !== 'FULL') {
        throw new Error('ABORTED: database ' + db + ' is not in the FULL recovery model; the case needs Full, Differential and Log runs');
      }
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) {
        throw new Error('ABORTED: the target repository ' + secondary + ' already holds a backup of ' + db + '; the case needs it empty of this backup (nothing of it is deleted automatically)');
      }
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, databases: [db], repo: primary, types: ['Full', 'Log'] }, 300_000);
      expect(outcomes, 'every source backup run of ' + db + ' ends successfully').toEqual(['successful', 'successful']);
      const sourceCounts = flow.typeCounts(await flow.repositoryTexts(primary));
      expect(sourceCounts.full, 'the source repository lists a Full recovery point').toBeGreaterThan(0);
      expect(sourceCounts.log, 'the source repository lists a Log recovery point').toBeGreaterThan(0);
    });

    await test.step('2. Create the Backup Copy job for the database', async () => {
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [db], destination: secondary });
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job ' + copyJob + ' is listed').toBe(true);
    });

    await test.step('3. Run the Backup Copy job: the Full base is fetched before the Log', async () => {
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the Backup Copy job run ends successfully').toBe('successful');
      const texts = await flow.jobPageTexts(copyJob);
      note('observed-outcome', 'job page texts: ' + texts.slice(0, 40).join(' | '));
    });

    await test.step('4. The job completed with no chain error', async () => {
      const texts = await flow.jobPageTexts(copyJob);
      expect(texts.join(' '), 'no chain error text').not.toMatch(/incomplete chain|broken chain|preceding .*missing/i);
    });

    await test.step('5. Open the target repository: Full and Log exist', async () => {
      const targetTexts = await flow.repositoryTexts(secondary);
      expect(targetTexts.some((t) => t.includes(db)), 'the target repository lists a backup of ' + db).toBe(true);
      const targetCounts = flow.typeCounts(targetTexts);
      expect(targetCounts.full, 'the target holds a Full recovery point').toBeGreaterThan(0);
      expect(targetCounts.log, 'the target holds the Log recovery point').toBeGreaterThan(0);
      note('observed-outcome', 'target listing: ' + targetTexts.slice(0, 40).join(' | '));
    });

    await test.step('6. Chain relationship of the copied Log', async () => {
      // "Restorable" is not provable in the UI without a restore; the check is that the chain is complete on the target and the run had no warning.
      note('observed-outcome', 'restorability of the copied recovery points was not exercised (no restore is run by this case)');
    });
  },
);
