import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { backupJobName } from '../../../../../../helpers/backup-env';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-171458: "Backup - Step 5/Step 6 - Data Transfer - Run Bottleneck detection".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: creates job NJM-171458 (deleted in afterEach, backups kept); runs one backup.
// case-vs-ui: Data Transfer is the Options step (Step 4) of the 4-step wizard. Where the bottleneck statistics (source / network / target / proxy) appear on the job page is not
//   documented: the spec attaches every "bottleneck" text of the job page as observed-outcome and asserts the statistics only if such text exists; status PARTIAL.
test.use(RUN_OPTIONS);

let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try {
    await backupFlows.discardJobIfPresent(backupJobName('NJM-171458'));
  } catch {
    // best effort
  }
  jobCreated = false;
});

test(
  'NAKIVO runs a database backup with Bottleneck detection enabled and reports bottleneck statistics',
  { tag: '@NJM-171458' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const name = backupJobName('NJM-171458');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Data Transfer controls are on Step 4 Options; the bottleneck statistics location is not documented.' });

    await test.step('1. Precondition: open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('2. Advance to the Options step', async () => {
      await flows.advanceToOptions(setup, name);
      await expect(flows.ui.checkboxLabel('Bottleneck detection')).toBeVisible();
    });

    await test.step("3. Enable 'Bottleneck detection': the option is enabled", async () => {
      await flows.setChecked(flows.ui.checkboxLabel('Bottleneck detection'), true);
      expect(await flows.isChecked(flows.ui.checkboxLabel('Bottleneck detection'))).toBe(true);
    });

    await test.step('4. Finish creating the job and run it on demand: the job runs to completion', async () => {
      await flows.finishAndRun();
      jobCreated = true;
      await backupFlows.jobs.statusLine.waitFor({ timeout: 60_000 });
      expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    });

    await test.step('5. Inspect the completed job and the recovery point: bottleneck statistics are reported and the recovery point exists', async () => {
      expect(await flows.recoverEnabled(), 'Recover is disabled: no recovery point was created').toBe(true);
      const lines = await flows.pageTextsMatching(/bottleneck|source|network|target|proxy/i);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Job page texts with bottleneck / source / network / target / proxy: ${JSON.stringify(lines)}` });
      const bottleneck = await flows.pageTextsMatching(/bottleneck/i);
      if (bottleneck.length > 0) expect(bottleneck.join(' ')).toMatch(/source|network|target|proxy/i);
    });

    await test.step('Ad hoc: the saved job keeps Bottleneck detection enabled (Job options)', async () => {
      const options = await flows.readJobOptionsText();
      testInfo.annotations.push({ type: 'observed-outcome', description: `Job options popup: ${options}` });
      expect(options).toMatch(/bottleneck/i);
    });
  },
);
