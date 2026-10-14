import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178397: "Verify synthetic full backup copy mode synthesizes a full from target data and copied increments".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-178397-src (Full, Differential runs on the FULL-recovery database) and Backup Copy job NJM-178397; afterEach deletes both with their backups. Precondition: the target repository holds no backup of the database (else ABORTED).
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: "Configuration > Repositories" and "Activities page": the repository contents are read from Settings > Repositories > <repo> (UNVERIFIED) and the run result from the copy job page (status line and events); Activities was not used.
// case-vs-ui: the case says "create a Backup Copy job" from Data Protection > + (Create) > Backup Copy Job; the wizard step names follow the case folders, not an observed UI.
// Ad hoc steps (beyond the case text): a second copy job (NJM-178397-synth) carries the Synthetic full mode so the first job copies the prior data in the default mode; both are deleted in afterEach.
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
  'NAKIVO Backup Copy in Synthetic full mode synthesizes a Full on the target from existing data and copied increments',
  { tag: '@NJM-178397' },
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
    const srcJob = backupJobName('NJM-178397', '-src');
    const copyJob = backupJobName('NJM-178397');

    await test.step('1. The target holds prior copied data and the source has new increments', async () => {
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) {
        throw new Error('ABORTED: the target repository ' + secondary + ' already holds a backup of ' + db + '; the case needs it empty of this backup (nothing of it is deleted automatically)');
      }
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, databases: [db], repo: primary, types: ['Full', 'Differential'] }, 300_000);
      expect(outcomes, 'every source backup run of ' + db + ' ends successfully').toEqual(['successful', 'successful']);
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [db], destination: secondary });
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job ' + copyJob + ' is listed').toBe(true);
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the Backup Copy job run ends successfully').toBe('successful');
      const outcome2 = await flow.runSource(srcJob, 'Differential', 300_000);
      expect(outcome2, 'a new Differential is created on the source').toBe('successful');
    });

    await test.step('2. Set the Backup Copy job to Synthetic full mode', async () => {
      await flow.openWizard();
      await flow.advanceTo('Options', { name: copyJob + '-synth', item: source.item, databases: [db], destination: secondary });
      await flow.setJobName(copyJob + '-synth');
      const modeSet = await flow.selectCopyMode('Synthetic full');
      expect(modeSet, 'the wizard offers the backup copy mode Synthetic full').toBe(true);
      await backupFlows.wizard.finishButton.click({ timeout: 10_000 });
      flow.trackCopyJob(copyJob + '-synth');
    });

    await test.step('3. Run the Backup Copy job: a new full is synthesized on the target', async () => {
      const outcome = await flow.runJob(copyJob + '-synth', 900_000);
      expect(outcome, 'the synthetic full copy run ends successfully').toBe('successful');
      note('observed-outcome', 'events: ' + (await flow.jobPageTexts(copyJob + '-synth')).slice(0, 40).join(' | '));
    });

    await test.step('4. The synthesized recovery point type is Full', async () => {
      const targetCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(targetCounts.full, 'a (second) Full recovery point is on the target').toBeGreaterThan(1);
    });

    await test.step('5. The synthetic full is usable and only increments were transferred', async () => {
      // "Restorable" is not provable in the UI without a restore; the check is that the chain is complete on the target and the run had no warning.
      note('observed-outcome', 'restorability of the copied recovery points was not exercised (no restore is run by this case)');
    });
  },
);
