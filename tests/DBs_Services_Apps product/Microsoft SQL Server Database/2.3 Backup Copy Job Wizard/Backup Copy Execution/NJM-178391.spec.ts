import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178391: "Verify recovery points already present in the target are skipped".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-178391-src (Full, Differential runs on the FULL-recovery database) and Backup Copy job NJM-178391; afterEach deletes both with their backups. Precondition: the target repository holds no backup of the database (else ABORTED).
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: "Configuration > Repositories" and "Activities page": the repository contents are read from Settings > Repositories > <repo> (UNVERIFIED) and the run result from the copy job page (status line and events); Activities was not used.
// case-vs-ui: the case says "create a Backup Copy job" from Data Protection > + (Create) > Backup Copy Job; the wizard step names follow the case folders, not an observed UI.
// Ad hoc steps (beyond the case text): the "subset already present" precondition is made by copying everything once; the second run then finds all of it present.
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
  'NAKIVO Backup Copy skips recovery points that are already present in the target and creates no duplicates',
  { tag: '@NJM-178391' },
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
    const srcJob = backupJobName('NJM-178391', '-src');
    const copyJob = backupJobName('NJM-178391');

    await test.step('1. The target already contains the source recovery points (first run copies them)', async () => {
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
      expect(before.full, 'the Full is on the target').toBe(1);
    });

    await test.step('2. Run the Backup Copy job again: it detects the points already in the target', async () => {
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the second run ends successfully').toBe('successful');
    });

    await test.step('3. The per-recovery-point outcome reports them as skipped', async () => {
      const texts = await flow.jobPageTexts(copyJob);
      expect.soft(texts.join(' '), 'the run reports the existing recovery points as skipped').toMatch(/skip|already|exist/i);
      note('observed-outcome', 'events: ' + texts.slice(0, 40).join(' | '));
    });

    await test.step('4. Open the target: unchanged, no duplicates', async () => {
      const after = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(after.full, 'still one Full').toBe(1);
      expect(after.incremental, 'still one Differential').toBe(1);
    });
  },
);
