import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupRepo, readBackupSource, readBackupValue } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-154872: "[MSSQL-BKC-0002] Verify Log Copy Failure on Missing Chain".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_COPY_BROKEN_LOG_DB (database whose source backup in NAKIVO_BK_REPO_PRIMARY has a Log with a gap or no Full before it, prepared by the owner), NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY.
// Side effects: creates Backup Copy job NJM-154872 (deleted in afterEach with its target backups); runs it once. Does not break any chain itself: a log gap needs an external native log backup or a deleted recovery point, which is not done here.
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
  'NAKIVO Backup Copy fails to copy a Log whose preceding chain is missing and creates no Log on the target',
  { tag: '@NJM-154872' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(900000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupValue('COPY_BROKEN_LOG_DB');
    const primary = readBackupRepo('PRIMARY');
    const secondary = readBackupRepo('SECONDARY');
    const copyJob = backupJobName('NJM-154872');

    await test.step('1. Inspect the source SQL backup: Log recovery points with a broken chain', async () => {
      const sourceCounts = flow.typeCounts(await flow.repositoryTexts(primary));
      expect(sourceCounts.log, 'the source holds Log recovery points').toBeGreaterThan(0);
    });

    await test.step('2. Confirm the missing predecessor cannot be auto-fetched (absent in source and target)', async () => {
      const targetTexts = await flow.repositoryTexts(secondary);
      if (targetTexts.some((t) => t.includes(db))) throw new Error('ABORTED: the target ' + secondary + ' already holds a backup of ' + db);
      note('observed-outcome', 'the gap in the source chain is prepared by the owner; the UI listing cannot prove it, so the run outcome in step 4 is the evidence');
    });

    await test.step('3. Create the Backup Copy job for the database targeting the secondary repository', async () => {
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [db], destination: secondary });
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job ' + copyJob + ' is listed').toBe(true);
    });

    await test.step('4. Run the Backup Copy job: the copy of the Log fails', async () => {
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the Backup Copy job run fails').toBe('failed');
    });

    await test.step('5. Read the job error text: preceding chain missing', async () => {
      const texts = await flow.jobPageTexts(copyJob);
      expect.soft(texts.join(' '), 'the failure names the missing / broken chain').toMatch(/chain|preced|Full|log/i);
      note('observed-outcome', 'job page texts: ' + texts.slice(0, 40).join(' | '));
    });

    await test.step('6. Open the target repository: no Log recovery point was created', async () => {
      const targetTexts = await flow.repositoryTexts(secondary);
      expect(flow.typeCounts(targetTexts).log, 'no Log recovery point on the target').toBe(0);
    });
  },
);
