import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178396: "Verify active full backup copy mode produces a full recovery point on the target".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-178396-src (Full, Differential runs on the FULL-recovery database) and Backup Copy job NJM-178396; afterEach deletes both with their backups. Precondition: the target repository holds no backup of the database (else ABORTED).
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: "Configuration > Repositories" and "Activities page": the repository contents are read from Settings > Repositories > <repo> (UNVERIFIED) and the run result from the copy job page (status line and events); Activities was not used.
// case-vs-ui: the case says "create a Backup Copy job" from Data Protection > + (Create) > Backup Copy Job; the wizard step names follow the case folders, not an observed UI.
// Ad hoc steps (beyond the case text): the mode setting is not known to exist for database copy jobs; if the wizard offers none, step 2 fails (case-vs-ui).
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
  'NAKIVO Backup Copy in Active full mode writes a Full recovery point on the target',
  { tag: '@NJM-178396' },
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
    const srcJob = backupJobName('NJM-178396', '-src');
    const copyJob = backupJobName('NJM-178396');

    await test.step('1. The source backup has recovery points', async () => {
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) {
        throw new Error('ABORTED: the target repository ' + secondary + ' already holds a backup of ' + db + '; the case needs it empty of this backup (nothing of it is deleted automatically)');
      }
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, databases: [db], repo: primary, types: ['Full', 'Differential'] }, 300_000);
      expect(outcomes, 'every source backup run of ' + db + ' ends successfully').toEqual(['successful', 'successful']);
    });

    await test.step('2. Create the Backup Copy job with the copy mode Active full', async () => {
      await flow.openWizard();
      await flow.advanceTo('Options', { name: copyJob, item: source.item, databases: [db], destination: secondary });
      await flow.setJobName(copyJob);
      const modeSet = await flow.selectCopyMode('Active full');
      expect(modeSet, 'the wizard offers the backup copy mode Active full').toBe(true);
      await backupFlows.wizard.finishButton.click({ timeout: 10_000 });
      flow.trackCopyJob(copyJob);
      expect(await backupFlows.jobExists(copyJob)).toBe(true);
    });

    await test.step('3. Run the Backup Copy job and wait for it to finish', async () => {
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the Backup Copy job run ends successfully').toBe('successful');
    });

    await test.step('4. The target recovery point type is Full', async () => {
      const targetCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(targetCounts.full, 'a Full recovery point is on the target').toBeGreaterThan(0);
    });

    await test.step('5. The active full is self-contained', async () => {
      // "Restorable" is not provable in the UI without a restore; the check is that the chain is complete on the target and the run had no warning.
      note('observed-outcome', 'restorability of the copied recovery points was not exercised (no restore is run by this case)');
    });
  },
);
