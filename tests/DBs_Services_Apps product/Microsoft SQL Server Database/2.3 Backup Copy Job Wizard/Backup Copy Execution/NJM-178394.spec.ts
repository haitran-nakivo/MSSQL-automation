import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupRepo, readBackupValue } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178394: "Verify source backup availability is checked before the copy job runs".
// Env (.env, owner-supplied): NAKIVO_BK_COPY_OFFLINE_JOB (name of an EXISTING Backup Copy job whose source repository the owner has taken offline), NAKIVO_BK_REPO_SECONDARY.
// Side effects: runs the owner-provided Backup Copy job once; creates, edits and deletes nothing. The repository is never taken offline by the test (unsafe); the owner prepares that state.
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
  'NAKIVO Backup Copy job fails early with a source-unavailable message when the source repository is offline',
  { tag: '@NJM-178394' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(600000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const copyJob = readBackupValue('COPY_OFFLINE_JOB');
    const secondary = readBackupRepo('SECONDARY');
    let targetBefore: string[] = [];

    await test.step('1. The Backup Copy job exists and is ready to run', async () => {
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job ' + copyJob + ' exists').toBe(true);
      targetBefore = await flow.repositoryTexts(secondary);
    });

    await test.step('2. The source backup is unavailable (repository offline, prepared by the owner)', async () => {
      note('observed-outcome', 'the source repository offline state is owner-prepared; it is evidenced by the failure in step 4');
    });

    await test.step('3. Run the Backup Copy job: availability is checked at the start', async () => {
      const outcome = await flow.runJob(copyJob, 300_000);
      expect(outcome, 'the run does not succeed').not.toBe('successful');
    });

    await test.step('4. The job fails early with a source-unavailable message', async () => {
      const outcomeText = await flow.jobPageTexts(copyJob);
      expect.soft(outcomeText.join(' '), 'the error says the source is unavailable').toMatch(/unavailable|offline|not available|not accessible|cannot access|unreachable/i);
      note('observed-outcome', 'job page texts: ' + outcomeText.slice(0, 40).join(' | '));
    });

    await test.step('5. Open the target: no partial recovery point was written', async () => {
      const targetAfter = await flow.repositoryTexts(secondary);
      const total = (c: { full: number; incremental: number; log: number }): number => c.full + c.incremental + c.log;
      expect(total(flow.typeCounts(targetAfter)), 'the target did not gain a recovery point').toBeLessThanOrEqual(total(flow.typeCounts(targetBefore)));
    });
  },
);
