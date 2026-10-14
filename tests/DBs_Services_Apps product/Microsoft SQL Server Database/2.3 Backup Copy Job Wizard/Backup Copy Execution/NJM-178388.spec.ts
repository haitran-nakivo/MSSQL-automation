import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178388: "Verify backup copy is forever-incremental and transfers only data missing in the target".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-178388-src (Full, Log runs on the FULL-recovery database) and Backup Copy job NJM-178388; afterEach deletes both with their backups. Precondition: the target repository holds no backup of the database (else ABORTED).
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: "Configuration > Repositories" and "Activities page": the repository contents are read from Settings > Repositories > <repo> (UNVERIFIED) and the run result from the copy job page (status line and events); Activities was not used.
// case-vs-ui: the case says "create a Backup Copy job" from Data Protection > + (Create) > Backup Copy Job; the wizard step names follow the case folders, not an observed UI.
// Ad hoc steps (beyond the case text): step 5 counts Log points (Full + 2 Logs after the second run).
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
  'NAKIVO Backup Copy is forever-incremental: a second run transfers only the new recovery point',
  { tag: '@NJM-178388' },
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
    const srcJob = backupJobName('NJM-178388', '-src');
    const copyJob = backupJobName('NJM-178388');

    await test.step('1. A Backup Copy job has copied the earlier recovery points to the target', async () => {
      if ((await host.recoveryModel(db)) !== 'FULL') {
        throw new Error('ABORTED: database ' + db + ' is not in the FULL recovery model; the case needs Full, Differential and Log runs');
      }
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) {
        throw new Error('ABORTED: the target repository ' + secondary + ' already holds a backup of ' + db + '; the case needs it empty of this backup (nothing of it is deleted automatically)');
      }
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, databases: [db], repo: primary, types: ['Full', 'Log'] }, 300_000);
      expect(outcomes, 'every source backup run of ' + db + ' ends successfully').toEqual(['successful', 'successful']);
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [db], destination: secondary });
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job ' + copyJob + ' is listed').toBe(true);
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the Backup Copy job run ends successfully').toBe('successful');
      const before = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(before.full + before.log, 'the target holds the earlier recovery points').toBeGreaterThan(1);
    });

    await test.step('2. Create a new recovery point on the source', async () => {
      const outcome = await flow.runSource(srcJob, 'Log', 300_000);
      expect(outcome, 'the new Log backup ends successfully').toBe('successful');
    });

    await test.step('3. Run the Backup Copy job again', async () => {
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the second copy run ends successfully').toBe('successful');
    });

    await test.step('4. Observe the data-transfer statistics of the run', async () => {
      const texts = await flow.jobPageTexts(copyJob);
      note('observed-outcome', 'transfer statistics / events of the second run (only the new Log may be sent): ' + texts.slice(0, 50).join(' | '));
      expect.soft(texts.join(' '), 'the run reports a transfer').toMatch(/transferred|incremental|bytes|MB|KB|GB/i);
    });

    await test.step('5. Open the target: the new recovery point is present without duplicates', async () => {
      const after = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(after.full, 'the Full was not copied again').toBe(1);
      expect(after.log, 'one more Log recovery point than before').toBe(2);
    });
  },
);
