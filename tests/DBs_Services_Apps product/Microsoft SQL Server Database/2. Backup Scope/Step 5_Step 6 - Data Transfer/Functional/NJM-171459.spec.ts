import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { backupJobName } from '../../../../../../helpers/backup-env';
import { readA7Setup, readLoadLimit } from '../../../../../../helpers/bkA7-env';

// NJM-171459: "Backup - Step 5/Step 6 - Data Transfer - Run job with all options".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY;
//   NAKIVO_BK_TRANSPORTER_LOAD_LIMIT only when the Options step offers "Limit transporter load to:".
// Side effects: creates job NJM-171459 (deleted in afterEach, backups kept); runs one backup. The case asks for <n> streams: 4 is used (a value inside 1-64).
// case-vs-ui: Data Transfer is the Options step (Step 4). "Limit transporter load to:" is not on the 11.2.1 database Options step; when absent it is recorded and skipped, the other two options
//   (concurrent streams, Bottleneck detection) are applied; status PARTIAL. The effect of each option is verified through the saved "Job options" text.
test.use(RUN_OPTIONS);

const STREAMS = 4;

let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try {
    await backupFlows.discardJobIfPresent(backupJobName('NJM-171459'));
  } catch {
    // best effort
  }
  jobCreated = false;
});

test(
  'NAKIVO runs a database backup with all Data Transfer options enabled together',
  { tag: '@NJM-171459' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const name = backupJobName('NJM-171459');

    await test.step('1. Precondition: open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('2. Advance to the Options step', async () => {
      await flows.advanceToOptions(setup, name);
      await expect(flows.ui.checkboxLabel('Limit data backup to')).toBeVisible();
    });

    await test.step('3. Enable all Data Transfer options together: streams, transporter load limit, Bottleneck detection', async () => {
      await flows.setChecked(flows.ui.checkboxLabel('Limit data backup to'), true);
      await flows.typeStreams(String(STREAMS));
      expect(await flows.streamsValue()).toBe(String(STREAMS));
      if (await flows.hasTransporterLoadControl()) {
        await flows.setTransporterLoad(readLoadLimit());
      } else {
        testInfo.annotations.push({ type: 'case-vs-ui', description: 'No "Limit transporter load to:" control on the 11.2.1 database Options step; skipped.' });
      }
      await flows.setChecked(flows.ui.checkboxLabel('Bottleneck detection'), true);
      expect(await flows.isChecked(flows.ui.checkboxLabel('Bottleneck detection'))).toBe(true);
    });

    await test.step('4. Finish creating the job and run it on demand: the job runs to completion', async () => {
      await flows.finishAndRun();
      jobCreated = true;
      await backupFlows.jobs.statusLine.waitFor({ timeout: 60_000 });
      expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    });

    await test.step('5. Verify the options took effect and the recovery point exists', async () => {
      expect(await flows.recoverEnabled(), 'Recover is disabled: no recovery point was created').toBe(true);
      const options = await flows.readJobOptionsText();
      testInfo.annotations.push({ type: 'observed-outcome', description: `Job options popup: ${options}` });
      expect(options).toContain(String(STREAMS));
      expect(options).toMatch(/bottleneck/i);
    });
  },
);
