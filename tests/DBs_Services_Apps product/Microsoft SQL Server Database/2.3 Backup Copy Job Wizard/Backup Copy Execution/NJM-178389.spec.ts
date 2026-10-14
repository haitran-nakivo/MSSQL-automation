import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178389: "Verify initial copy run transfers recovery points starting from the oldest required by retention".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-178389-src (Full, Differential runs on the FULL-recovery database) and Backup Copy job NJM-178389; afterEach deletes both with their backups. Precondition: the target repository holds no backup of the database (else ABORTED).
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: "Configuration > Repositories" and "Activities page": the repository contents are read from Settings > Repositories > <repo> (UNVERIFIED) and the run result from the copy job page (status line and events); Activities was not used.
// case-vs-ui: the case says "create a Backup Copy job" from Data Protection > + (Create) > Backup Copy Job; the wizard step names follow the case folders, not an observed UI.
// Ad hoc steps (beyond the case text): the case parameter <retention-count> is fixed at 2 recovery points.
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
  'NAKIVO initial Backup Copy run starts from the oldest recovery point required by the retention and skips older ones',
  { tag: '@NJM-178389' },
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
    const srcJob = backupJobName('NJM-178389', '-src');
    const copyJob = backupJobName('NJM-178389');

    await test.step('1. The source has a Full and three Differentials (older and newer than the retention boundary)', async () => {
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) {
        throw new Error('ABORTED: the target repository ' + secondary + ' already holds a backup of ' + db + '; the case needs it empty of this backup (nothing of it is deleted automatically)');
      }
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, databases: [db], repo: primary, types: ['Full', 'Differential', 'Differential', 'Differential'] }, 300_000);
      expect(outcomes, 'every source backup run of ' + db + ' ends successfully').toEqual(['successful', 'successful', 'successful', 'successful']);
      expect(flow.typeCounts(await flow.repositoryTexts(primary)).incremental, 'three Differentials in the source').toBeGreaterThanOrEqual(3);
    });

    await test.step('2. Create the Backup Copy job with retention: keep 2 recovery points', async () => {
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [db], destination: secondary, retention: { exactCopy: false, count: 2 } });
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job is listed').toBe(true);
    });

    await test.step('3. Run the initial Backup Copy job', async () => {
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the initial copy run ends successfully').toBe('successful');
      note('observed-outcome', 'events: ' + (await flow.jobPageTexts(copyJob)).slice(0, 40).join(' | '));
    });

    await test.step('4. Open the target: recovery points from the oldest required forward, none older', async () => {
      const targetCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(targetCounts.incremental, 'only the two newest Differentials are on the target').toBe(2);
      expect(targetCounts.full, 'the base Full the two Differentials need is on the target').toBe(1);
    });
  },
);
