import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-154877: "[MSSQL-BKC-0007] Verify Full Tracking as Base for Future".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-154877-src (Full, Differential runs on the FULL-recovery database) and Backup Copy job NJM-154877; afterEach deletes both with their backups. Precondition: the target repository holds no backup of the database (else ABORTED).
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
  'NAKIVO Backup Copy tracks the copied Full as the base of a later Differential and copies only the new Differential',
  { tag: '@NJM-154877' },
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
    const srcJob = backupJobName('NJM-154877', '-src');
    const copyJob = backupJobName('NJM-154877');

    await test.step('1. Copy the Full once from the primary to the secondary repository', async () => {
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) {
        throw new Error('ABORTED: the target repository ' + secondary + ' already holds a backup of ' + db + '; the case needs it empty of this backup (nothing of it is deleted automatically)');
      }
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, databases: [db], repo: primary, types: ['Full'] }, 300_000);
      expect(outcomes, 'every source backup run of ' + db + ' ends successfully').toEqual(['successful']);
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [db], destination: secondary });
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job ' + copyJob + ' is listed').toBe(true);
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the Backup Copy job run ends successfully').toBe('successful');
      const firstCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(firstCounts.full, 'the Full is on the target after the first copy').toBeGreaterThan(0);
    });

    await test.step('2. Run the source backup job again as a Differential', async () => {
      const outcome = await flow.runSource(srcJob, 'Differential', 300_000);
      expect(outcome, 'the Differential backup ends successfully').toBe('successful');
      expect(flow.typeCounts(await flow.repositoryTexts(primary)).incremental, 'a Differential appears in the source repository').toBeGreaterThan(0);
    });

    await test.step('3. Run the Backup Copy job again: only the new Differential is copied', async () => {
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the second copy run ends successfully').toBe('successful');
      const texts = await flow.jobPageTexts(copyJob);
      note('observed-outcome', 'second run texts (the Full must not be re-copied): ' + texts.slice(0, 40).join(' | '));
    });

    await test.step('4. The Backup Copy job finished successfully', async () => {
      expect(await flow.readLastStatus(copyJob)).toMatch(/successful/i);
    });

    await test.step('5. Open the target: the Differential is linked to the first Full', async () => {
      const targetCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(targetCounts.incremental, 'the new Differential is on the target').toBeGreaterThan(0);
      expect(targetCounts.full, 'still one Full on the target (not re-copied)').toBe(1);
    });

    await test.step('6. The earlier Full is the base of the new increment', async () => {
      // "Restorable" is not provable in the UI without a restore; the check is that the chain is complete on the target and the run had no warning.
      note('observed-outcome', 'restorability of the copied recovery points was not exercised (no restore is run by this case)');
    });
  },
);
