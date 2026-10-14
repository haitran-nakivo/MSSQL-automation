import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupRepo, readBackupSource, readBackupValue } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-154871: "[MSSQL-BKC-0001] Verify Diff Copy Failure on Missing Base".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_COPY_MISSING_BASE_DB (database whose source backup in NAKIVO_BK_REPO_PRIMARY has a Differential but NO base Full, prepared by the owner), NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY.
// Side effects: creates Backup Copy job NJM-154871 (deleted in afterEach with its target backups); runs it once. Never removes or expires anything in the source: the missing base Full must already be missing, because there is no safe UI way to remove one Full from a chain.
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
  'NAKIVO Backup Copy fails to copy a Differential whose base Full is missing and creates no Differential on the target',
  { tag: '@NJM-154871' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(900000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupValue('COPY_MISSING_BASE_DB');
    const primary = readBackupRepo('PRIMARY');
    const secondary = readBackupRepo('SECONDARY');
    const copyJob = backupJobName('NJM-154871');

    await test.step('1. Inspect the source SQL backup of the database in the primary repository', async () => {
      const sourceCounts = flow.typeCounts(await flow.repositoryTexts(primary));
      expect(sourceCounts.incremental, 'the source holds a dependent Differential').toBeGreaterThan(0);
    });

    await test.step('2. Confirm the base Full is unavailable in the source and absent from the target', async () => {
      const sourceCounts = flow.typeCounts(await flow.repositoryTexts(primary));
      if (sourceCounts.full > 0) throw new Error('ABORTED: the source backup of ' + db + ' still has a Full recovery point; the case needs a Differential whose base Full is gone (NAKIVO_BK_COPY_MISSING_BASE_DB)');
      const targetTexts = await flow.repositoryTexts(secondary);
      if (targetTexts.some((t) => t.includes(db))) throw new Error('ABORTED: the target ' + secondary + ' already holds a backup of ' + db);
    });

    await test.step('3. Create the Backup Copy job for the database targeting the secondary repository', async () => {
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [db], destination: secondary });
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job ' + copyJob + ' is listed').toBe(true);
    });

    await test.step('4. Run the Backup Copy job: the copy of the Differential fails', async () => {
      const outcome = await flow.runJob(copyJob, 900_000);
      expect(outcome, 'the Backup Copy job run fails').toBe('failed');
    });

    await test.step('5. Read the job error text: incomplete chain, base Full missing', async () => {
      const texts = await flow.jobPageTexts(copyJob);
      expect.soft(texts.join(' '), 'the failure names the missing base / incomplete chain').toMatch(/base|chain|Full|dependen/i);
      note('observed-outcome', 'job page texts: ' + texts.slice(0, 40).join(' | '));
    });

    await test.step('6. Open the target repository: no Differential was created', async () => {
      const targetTexts = await flow.repositoryTexts(secondary);
      expect(flow.typeCounts(targetTexts).incremental, 'no Differential recovery point on the target').toBe(0);
    });
  },
);
