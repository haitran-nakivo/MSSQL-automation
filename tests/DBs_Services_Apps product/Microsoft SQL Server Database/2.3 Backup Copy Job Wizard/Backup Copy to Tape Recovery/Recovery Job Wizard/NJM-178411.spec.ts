import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../../flows/bkA7-tape.flows';
import { readSecondaryRepo, readTapeLibrary, readTapeSqlBackup } from '../../../../../../helpers/bkA7-env';

// NJM-178411: "Verify Step 4 Options default job name is Full recovery from tape job for Database".
// Env (.env, owner-supplied): NAKIVO_BK_TAPE_LIBRARY, NAKIVO_BK_TAPE_SQL_BACKUP (a SQL backup already on that library), NAKIVO_BK_REPO_SECONDARY (destination). Without them the test ends ABORTED.
// Side effects: none (the wizard is walked to its Options step and cancelled; no job is created).
// case-vs-ui: UNVERIFIED (wizard never opened live). The Options step is recognised by the "Job name:" field (same label as the backup wizard); the wizard is walked with Next from Step 1 (backup) and Step 2 (repository).
//   The default name is asserted exactly as the case states it; the "other job options" are asserted as: Finish is offered next to Cancel. Status IMPLEMENTED_ENV_GATED.
test.use(RUN_OPTIONS);

const DEFAULT_NAME = 'Full recovery from tape job for Database';

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7TapeFlows(page, backupFlows).cancelWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO defaults the tape recovery job name to "Full recovery from tape job for Database" and lets it be edited',
  { tag: '@NJM-178411' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    const tape = readTapeLibrary();
    const backup = readTapeSqlBackup();
    const repo = readSecondaryRepo();
    const flows = new BkA7TapeFlows(page, backupFlows);
    const jobName = () => backupFlows.wizard.jobNameField;

    await test.step('1. In the tape Recovery Job Wizard with the backup selected and a destination repository chosen, proceed to Step 4 (Options)', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      const rows = await flows.openTapeResource(tape.library);
      if (!rows.join('\n').includes(backup)) throw new Error(`ABORTED: the backup "${backup}" is not listed on the library`);
      await flows.openRecoverMenuFor(backup);
      await flows.chooseRecoverToRepository();
      const steps = await flows.walkToOptions(backup, repo);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Next pressed ${steps} times to reach the Options step` });
      await expect(jobName()).toBeVisible();
    });

    await test.step('2. Inspect the default value of the job name field: Full recovery from tape job for Database', async () => {
      expect(await backupFlows.fieldValue(jobName())).toBe(DEFAULT_NAME);
    });

    await test.step('3. Edit the job name field: it accepts a custom value', async () => {
      await jobName().click({ timeout: 10_000 });
      await jobName().press('Control+A');
      await jobName().pressSequentially('NJM-178411-custom', { delay: 60 });
      await jobName().press('Tab');
      expect(await backupFlows.fieldValue(jobName())).toBe('NJM-178411-custom');
    });

    await test.step('4. Review the remaining controls on the Options page: the wizard can be completed (Finish offered)', async () => {
      await expect(flows.ui.finishButton()).toBeVisible();
      const texts = await backupFlows.visibleTexts();
      testInfo.annotations.push({ type: 'observed-outcome', description: `Options step texts: ${JSON.stringify(texts)}` });
    });
  },
);
