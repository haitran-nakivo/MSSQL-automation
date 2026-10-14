import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178390: "Verify incremental copy run transfers only new recovery points since the last copied".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-178390-src (Full, Differential runs on the FULL-recovery database) and Backup Copy job NJM-178390; afterEach deletes both with their backups. Precondition: the target repository holds no backup of the database (else ABORTED).
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
  'NAKIVO incremental Backup Copy run transfers only the recovery points newer than the last copied one',
  { tag: '@NJM-178390' },
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
    const srcJob = backupJobName('NJM-178390', '-src');
    const copyJob = backupJobName('NJM-178390');

    await test.step('1. A first Backup Copy run has copied the Full and the first Differential', async () => {
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) {
        throw new Error('ABORTED: the target repository ' + secondary + ' already holds a backup of ' + db + '; the case needs it empty of this backup (nothing of it is deleted automatically)');
      }
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, databases: [db], repo: primary, types: ['Full', 'Differential'] }, 300_000);
      expect(outcomes, 'every source backup run of ' + db + ' ends successfully').toEqual(['successful', 'successful']);
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [db], destination: secondary });
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job ' + copyJob + ' is listed').toBe(true);
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the Backup Copy job run ends successfully').toBe('successful');
      const before = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(before.incremental, 'the target holds the first Differential').toBe(1);
    });

    await test.step('2. Create a new Differential on the source', async () => {
      const outcome = await flow.runSource(srcJob, 'Differential', 300_000);
      expect(outcome, 'the new Differential backup ends successfully').toBe('successful');
    });

    await test.step('3. Run the Backup Copy job again', async () => {
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the second copy run ends successfully').toBe('successful');
      note('observed-outcome', 'events: ' + (await flow.jobPageTexts(copyJob)).slice(0, 40).join(' | '));
    });

    await test.step('4. Open the target: only the new recovery point was added', async () => {
      const after = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(after.incremental, 'two Differentials on the target').toBe(2);
      expect(after.full, 'the Full is untouched (still one)').toBe(1);
    });
  },
);
