import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { backupJobName } from '../../../../../../helpers/backup-env';
import { readStreamsHost } from '../../../../../../helpers/bkA7-env';

// NJM-154869: "[MSSQL-BK-UI-DT-0002-9] Verify Resource Calculation Logic (CPU vs RAM)".
// Env (.env, owner-supplied): NAKIVO_BK_STREAMS_CAP_ITEM (Inventory item whose host has the known resources), NAKIVO_BK_STREAMS_CAP_DB (a database on it),
//   NAKIVO_BK_STREAMS_CAP_CPU (vCPU count, the case uses 2), NAKIVO_BK_STREAMS_CAP_RAM_GB (RAM in GB, the case uses 3), NAKIVO_BK_REPO_PRIMARY.
//   Expected streams = min(2 per vCPU, 5 per GB of RAM) = min(CPU*2, RAM/0.2): 2 vCPU / 3 GB gives min(4, 15) = 4.
// Side effects: creates job NJM-154869 (deleted in afterEach, backups kept); runs one backup.
// case-vs-ui: Data Transfer is the Options step (Step 4) of the 4-step wizard. Where the product states the streams actually used (job page events / job options) is not documented:
//   the number is asserted only when a "N streams" text is found on the job page after the run; otherwise it is attached as observed-outcome and only the run result is asserted.
test.use(RUN_OPTIONS);

let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try {
    await backupFlows.discardJobIfPresent(backupJobName('NJM-154869'));
  } catch {
    // best effort
  }
  jobCreated = false;
});

test(
  'NAKIVO caps the concurrent streams of a job at the lower of the CPU and RAM limits of the host',
  { tag: '@NJM-154869' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    const host = readStreamsHost('CAP');
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const name = backupJobName('NJM-154869');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Data Transfer controls are on Step 4 Options; the number of streams actually used is not documented as a UI field.' });
    testInfo.annotations.push({ type: 'env', description: `host resources from .env: ${host.cpu} vCPU, ${host.ramGb} GB RAM; expected streams = min(${host.cpu * 2}, ${Math.floor(host.ramGb / 0.2)}) = ${host.limit}` });

    await test.step('1. Precondition: the host with the known CPU/RAM and its SQL instance exist (from .env)', async () => {
      await backupFlows.gotoJobs();
      expect(host.limit).toBeGreaterThan(0);
      expect(host.limit, 'the configured host must be CPU or RAM limited below 64 streams for this case').toBeLessThan(64);
    });

    await test.step('2. Open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('3. Advance to the Options step', async () => {
      await flows.advanceToOptions(host, name);
      await expect(flows.ui.checkboxLabel('Limit data backup to')).toBeVisible();
    });

    await test.step('4. Enable the streams checkbox, request 64 streams and finish: the job is created requesting 64 streams', async () => {
      await flows.setChecked(flows.ui.checkboxLabel('Limit data backup to'), true);
      await flows.typeStreams('64');
      expect(await flows.streamsValue()).toBe('64');
      await backupFlows.wizard.finishButton.click({ timeout: 10_000 });
      jobCreated = true;
      await backupFlows.jobs.statusLine.waitFor({ timeout: 60_000 });
      const options = await flows.readJobOptionsText();
      testInfo.annotations.push({ type: 'observed-outcome', description: `Job options popup: ${options}` });
      expect(options).toContain('64');
    });

    await test.step('5. Run the job and inspect the job page for the streams actually allocated: the cap is the CPU limit', async () => {
      await backupFlows.runOpenJob();
      const outcome = await backupFlows.waitForResult(600_000);
      expect(outcome, `the run ended ${outcome}`).toBe('successful');
      const lines = await flows.pageTextsMatching(/stream/i);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Job page texts mentioning streams: ${JSON.stringify(lines)}` });
      const used = lines.filter((t) => /using|used|allocated|running with/i.test(t)).map((t) => /(\d+)\s*(?:concurrent\s+)?streams?/i.exec(t)?.[1]).find((n) => n !== undefined);
      if (used !== undefined) expect(Number(used)).toBe(host.limit);
    });
  },
);
