import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178376: "[MSSQL-BKC-RET-03] Verify a differential is deleted only when not retained by policy".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-178376-src and Backup Copy job NJM-178376; afterEach deletes both with their backups. ABORTED when the target already holds a backup of the database.
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: the cases say "Jobs > Create > Backup copy job for Microsoft SQL Server": the UI entry is Data Protection > + > Backup Copy Job (a Microsoft SQL Server choice may follow; UNVERIFIED).
// case-vs-ui: the cases describe five steps (Source, Destination, Schedule, Retention, Options); the wizard is only checked for the steps it really shows (CopyFlows.presentSteps) and a missing step is recorded as case-vs-ui.
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
  'NAKIVO Backup Copy deletes an older Differential from the target only when the retention policy no longer covers it',
  { tag: '@NJM-178376' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(1800000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupDatabase('INSTANCE', 'FULL');
    const primary = readBackupRepo('PRIMARY');
    const secondary = readBackupRepo('SECONDARY');
    const srcJob = backupJobName('NJM-178376', '-src');
    const copyJob = backupJobName('NJM-178376');

    await test.step('1. Precondition: the target holds a Full and a dependent Differential', async () => {
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) throw new Error('ABORTED: the target repository ' + secondary + ' already holds a backup of ' + db);
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, databases: [db], repo: primary, types: ['Full', 'Differential'] }, 300_000);
      expect(outcomes.every((o) => o === 'successful'), 'every source backup run ends successfully').toBe(true);
      await flow.openWizard();
      await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
      await flow.completeFromSource({ name: copyJob, item: source.item, databases: [db], destination: secondary, retention: { exactCopy: false, count: 1 } });
      expect(await flow.runJob(copyJob, 900_000), 'the first copy run ends successfully').toBe('successful');
      const targetCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(targetCounts.full).toBe(1);
      expect(targetCounts.incremental, 'the first Differential is retained (keep 1)').toBe(1);
    });

    await test.step('2. The job retention (keep 1) is shown', async () => {
      note('case-vs-ui', 'the retention is set when the job is created (keep 1 recovery point); re-opening the job to lower it is not used, a newer Differential pushes the older one out of the policy instead');
    });

    await test.step('3. A newer Differential makes the older one fall out of the policy', async () => {
      expect(await flow.runSource(srcJob, 'Differential', 300_000), 'the second Differential backup ends successfully').toBe('successful');
    });

    await test.step('4. Run the copy job: retention runs on the target', async () => {
      expect(await flow.runJob(copyJob, 900_000), 'the second copy run ends successfully').toBe('successful');
    });

    await test.step('5. The older Differential is gone only because the policy no longer retains it', async () => {
      const targetCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(targetCounts.incremental, 'only the newest Differential (the retained one) is on the target').toBe(1);
      expect(targetCounts.full, 'the base Full is kept for the retained Differential').toBe(1);
    });
  },
);
