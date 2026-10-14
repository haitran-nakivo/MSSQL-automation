import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupRepo, readBackupSource, readBackupValue } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178392: "Verify expired recovery points are skipped but an expired dependency is still copied".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_COPY_EXPIRED_DB (database whose source backup has an expired base Full, a non-expired dependent increment and expired standalone points, prepared by the owner), NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY.
// Side effects: creates Backup Copy job NJM-178392 (deleted in afterEach with its target backups); runs it once. Expiry cannot be forced from the UI, so the source state is owner-prepared and never modified.
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
  'NAKIVO Backup Copy skips purely expired recovery points but still copies an expired base Full that a valid increment needs',
  { tag: '@NJM-178392' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(900000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupValue('COPY_EXPIRED_DB');
    const primary = readBackupRepo('PRIMARY');
    const secondary = readBackupRepo('SECONDARY');
    const copyJob = backupJobName('NJM-178392');

    await test.step('1. The source holds an expired base Full, a valid dependent increment and expired standalone points', async () => {
      const sourceTexts = await flow.repositoryTexts(primary);
      expect(sourceTexts.some((t) => t.includes(db)), 'the prepared source backup is listed').toBe(true);
      if (sourceTexts.every((t) => !/expired/i.test(t))) throw new Error('ABORTED: the source listing shows no expired recovery point for ' + db + '; prepare it (NAKIVO_BK_COPY_EXPIRED_DB)');
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) throw new Error('ABORTED: the target already holds a backup of ' + db);
      note('observed-outcome', 'source listing: ' + sourceTexts.slice(0, 50).join(' | '));
    });

    await test.step('2. Create and run the Backup Copy job; each recovery point is evaluated against expiration', async () => {
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [db], destination: secondary });
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job ' + copyJob + ' is listed').toBe(true);
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the Backup Copy job run ends successfully').toBe('successful');
    });

    await test.step('3. Per-recovery-point outcome: purely expired points skipped, the expired base still copied', async () => {
      const texts = await flow.jobPageTexts(copyJob);
      expect.soft(texts.join(' '), 'the run reports skipped expired points').toMatch(/skip|expired/i);
      note('observed-outcome', 'events: ' + texts.slice(0, 50).join(' | '));
    });

    await test.step('4. Open the target: the increment and its expired base are there, purely expired points are absent', async () => {
      const targetCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(targetCounts.full, 'the expired base Full is copied because the increment depends on it').toBeGreaterThan(0);
      expect(targetCounts.incremental + targetCounts.log, 'the valid increment is on the target').toBeGreaterThan(0);
    });
  },
);
