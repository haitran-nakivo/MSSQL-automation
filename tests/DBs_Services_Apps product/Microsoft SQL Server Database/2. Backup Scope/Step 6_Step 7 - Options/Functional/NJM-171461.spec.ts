import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { backupJobName } from '../../../../../../helpers/backup-env';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-171461: "Backup - Step 6/Step 7 - Options - Run Network acceleration".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: creates job NJM-171461 (deleted in afterEach, backups kept); runs one backup.
// case-vs-ui: Options is Step 4 of the 4-step wizard. "Network acceleration applied" is verified through the saved "Job options" text (Observed: it shows the saved options); the Director
//   shows no other per-run indicator of acceleration in the notes.
test.use(RUN_OPTIONS);

let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try {
    await backupFlows.discardJobIfPresent(backupJobName('NJM-171461'));
  } catch {
    // best effort
  }
  jobCreated = false;
});

test(
  'NAKIVO runs a database backup with Network acceleration enabled',
  { tag: '@NJM-171461' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const name = backupJobName('NJM-171461');

    await test.step('1. Precondition: open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('2. Advance to the Options step', async () => {
      await flows.advanceToOptions(setup, name);
      await expect(flows.ui.optionLabel('Network acceleration')).toBeVisible();
    });

    await test.step("3. Enable 'Network acceleration': the option shows Enabled", async () => {
      await flows.pickOption('Network acceleration', 'Enabled');
      expect(await flows.comboValue('Network acceleration')).toBe('Enabled');
    });

    await test.step('4. Finish creating the job and run it on demand: the job runs to completion', async () => {
      await flows.finishAndRun();
      jobCreated = true;
      await backupFlows.jobs.statusLine.waitFor({ timeout: 60_000 });
      expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    });

    await test.step('5. Verify the job result and recovery point: success, network acceleration saved, recovery point exists', async () => {
      expect(await flows.recoverEnabled(), 'Recover is disabled: no recovery point was created').toBe(true);
      const options = await flows.readJobOptionsText();
      testInfo.annotations.push({ type: 'observed-outcome', description: `Job options popup: ${options}` });
      expect(options).toMatch(/acceleration/i);
    });
  },
);
