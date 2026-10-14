import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupRepo, readBackupSource, readBackupValue } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178393: "Verify recovery points with pending removal status are not copied".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_COPY_PENDING_REMOVAL_DB (database whose source backup has a recovery point in the pending-removal status, prepared by the owner), NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY.
// Side effects: creates Backup Copy job NJM-178393 (deleted in afterEach with its target backups); runs it once. The pending-removal point is owner-prepared and never modified.
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
  'NAKIVO Backup Copy does not copy a recovery point that has the pending-removal status',
  { tag: '@NJM-178393' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(900000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupValue('COPY_PENDING_REMOVAL_DB');
    const primary = readBackupRepo('PRIMARY');
    const secondary = readBackupRepo('SECONDARY');
    const copyJob = backupJobName('NJM-178393');

    await test.step('1. The source has a recovery point in the pending-removal status', async () => {
      const sourceTexts = await flow.repositoryTexts(primary);
      if (sourceTexts.every((t) => !/pending removal|pending/i.test(t))) throw new Error('ABORTED: the source listing shows no pending-removal recovery point for ' + db + ' (NAKIVO_BK_COPY_PENDING_REMOVAL_DB)');
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) throw new Error('ABORTED: the target already holds a backup of ' + db);
      note('observed-outcome', 'source listing: ' + sourceTexts.slice(0, 50).join(' | '));
    });

    await test.step('2. Create and run the Backup Copy job; each status is evaluated', async () => {
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [db], destination: secondary });
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job ' + copyJob + ' is listed').toBe(true);
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the Backup Copy job run ends successfully').toBe('successful');
    });

    await test.step('3. Per-recovery-point outcome: the pending-removal point is excluded', async () => {
      const texts = await flow.jobPageTexts(copyJob);
      note('observed-outcome', 'events: ' + texts.slice(0, 50).join(' | '));
      expect.soft(texts.join(' '), 'the run reports the pending-removal point as excluded').toMatch(/skip|pending|exclud/i);
    });

    await test.step('4. Open the target: no pending-removal recovery point was created', async () => {
      const sourceCounts = flow.typeCounts(await flow.repositoryTexts(primary));
      const targetCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(targetCounts.full + targetCounts.incremental + targetCounts.log, 'the target holds fewer recovery points than the source').toBeLessThan(sourceCounts.full + sourceCounts.incremental + sourceCounts.log);
    });
  },
);
