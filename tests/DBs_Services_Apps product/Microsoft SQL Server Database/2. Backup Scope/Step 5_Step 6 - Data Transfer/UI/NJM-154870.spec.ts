import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { backupJobName } from '../../../../../../helpers/backup-env';
import { readStreamsHost } from '../../../../../../helpers/bkA7-env';

// NJM-154870: "[MSSQL-BK-UI-DT-0002-10] Verify Auto-Throttling Logic".
// Env (.env, owner-supplied): NAKIVO_BK_STREAMS_LOW_ITEM (Inventory item whose host has few resources), NAKIVO_BK_STREAMS_LOW_DB (a database on it),
//   NAKIVO_BK_STREAMS_LOW_CPU (the case uses 1 vCPU), NAKIVO_BK_STREAMS_LOW_RAM_GB (the case uses 1 GB), NAKIVO_BK_REPO_PRIMARY.
//   The resource limit is min(2 per vCPU, 5 per GB of RAM): 1 vCPU / 1 GB gives 2. The job requests 10 streams, above that limit.
// Side effects: creates job NJM-154870 (deleted in afterEach, backups kept); runs one backup.
// case-vs-ui: Data Transfer is the Options step (Step 4) of the 4-step wizard. The streams actually used are asserted only when the job page states them (see NJM-154869);
//   the firm assertion is the one in the case: the job does not fail and completes successfully.
test.use(RUN_OPTIONS);

let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try {
    await backupFlows.discardJobIfPresent(backupJobName('NJM-154870'));
  } catch {
    // best effort
  }
  jobCreated = false;
});

test(
  'NAKIVO throttles a job that requests more streams than the host resources allow instead of failing it',
  { tag: '@NJM-154870' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    const host = readStreamsHost('LOW');
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const name = backupJobName('NJM-154870');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Data Transfer controls are on Step 4 Options; the number of streams actually used is not documented as a UI field.' });
    testInfo.annotations.push({ type: 'env', description: `host resources from .env: ${host.cpu} vCPU, ${host.ramGb} GB RAM; resource limit = ${host.limit} streams` });

    await test.step('1. Precondition: the low-resource host and its SQL instance exist (from .env) and 10 streams exceed its limit', async () => {
      await backupFlows.gotoJobs();
      expect(host.limit, 'the configured host must have a stream limit below 10 for this case').toBeLessThan(10);
    });

    await test.step('2. Open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('3. Advance to the Options step', async () => {
      await flows.advanceToOptions(host, name);
      await expect(flows.ui.checkboxLabel('Limit data backup to')).toBeVisible();
    });

    await test.step('4. Enable the streams checkbox, request 10 streams and finish: the job is created requesting 10 streams', async () => {
      await flows.setChecked(flows.ui.checkboxLabel('Limit data backup to'), true);
      await flows.typeStreams('10');
      expect(await flows.streamsValue()).toBe('10');
      await backupFlows.wizard.finishButton.click({ timeout: 10_000 });
      jobCreated = true;
      await backupFlows.jobs.statusLine.waitFor({ timeout: 60_000 });
      const options = await flows.readJobOptionsText();
      testInfo.annotations.push({ type: 'observed-outcome', description: `Job options popup: ${options}` });
      expect(options).toContain('10');
    });

    await test.step('5. Run the job and monitor it: it does not fail and completes successfully (auto-throttled)', async () => {
      await backupFlows.runOpenJob();
      const outcome = await backupFlows.waitForResult(600_000);
      expect(outcome, `the run ended ${outcome}`).toBe('successful');
      const lines = await flows.pageTextsMatching(/stream/i);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Job page texts mentioning streams: ${JSON.stringify(lines)}` });
      const used = lines.filter((t) => /using|used|allocated|running with/i.test(t)).map((t) => /(\d+)\s*(?:concurrent\s+)?streams?/i.exec(t)?.[1]).find((n) => n !== undefined);
      if (used !== undefined) expect(Number(used)).toBeLessThanOrEqual(host.limit);
    });
  },
);
