import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178375: "[MSSQL-BKC-RET-02] Verify base full is retained while a dependent differential is retained".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-178375-src and Backup Copy job NJM-178375; afterEach deletes both with their backups. ABORTED when the target already holds a backup of the database.
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
  'NAKIVO Backup Copy retains the base Full while its dependent Differential is retained',
  { tag: '@NJM-178375' },
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
    const srcJob = backupJobName('NJM-178375', '-src');
    const copyJob = backupJobName('NJM-178375');

    await test.step('1. Precondition: the source has a Full and a dependent Differential', async () => {
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) throw new Error('ABORTED: the target repository ' + secondary + ' already holds a backup of ' + db);
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, databases: [db], repo: primary, types: ['Full', 'Differential'] }, 300_000);
      expect(outcomes.every((o) => o === 'successful'), 'every source backup run ends successfully').toBe(true);
      expect(flow.typeCounts(await flow.repositoryTexts(primary)).incremental).toBeGreaterThan(0);
    });

    await test.step('2. Create a Backup Copy job selecting the database source', async () => {
      await flow.openWizard();
      await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    });

    await test.step('3. Retention: keep 1 recovery point (the Differential is the retained one)', async () => {
      const request = { name: copyJob, item: source.item, databases: [db], destination: secondary, retention: { exactCopy: false, count: 1 } };
      await flow.completeFromSource(request);
      expect(await backupFlows.jobExists(copyJob)).toBe(true);
    });

    await test.step('4. Run the Backup Copy job: the Full and the Differential are copied', async () => {
      expect(await flow.runJob(copyJob, 900_000), 'the copy run ends successfully').toBe('successful');
    });

    await test.step('5. Retention processing: the base Full is retained because the Differential is retained', async () => {
      const targetCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(targetCounts.incremental, 'the Differential is retained').toBe(1);
      expect(targetCounts.full, 'the base Full is retained, not deleted').toBe(1);
    });
  },
);
