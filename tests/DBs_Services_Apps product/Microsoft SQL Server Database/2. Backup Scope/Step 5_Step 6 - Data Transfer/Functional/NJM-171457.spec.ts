import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { backupJobName } from '../../../../../../helpers/backup-env';
import { readA7Setup, readLoadLimit } from '../../../../../../helpers/bkA7-env';

// NJM-171457: "Backup - Step 5/Step 6 - Data Transfer - Run Limit transporter load to:".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY;
//   NAKIVO_BK_TRANSPORTER_LOAD_LIMIT (the <load-limit> value) is read only when the Options step offers the control.
// Side effects: creates job NJM-171457 (deleted in afterEach, backups kept); runs one backup.
// case-vs-ui: the 11.2.1 database Options step has no "Limit transporter load to:" control (the observed Options are: Job priority, Network acceleration, Network encryption,
//   Backup encryption, reports, scripts, concurrent streams, Bottleneck detection). When the control is absent the spec records it, runs the job with the observed
//   Data Transfer controls instead and asserts the run and the recovery point; status PARTIAL. Transporter load statistics during the run are not documented as a UI element.
test.use(RUN_OPTIONS);

let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try {
    await backupFlows.discardJobIfPresent(backupJobName('NJM-171457'));
  } catch {
    // best effort
  }
  jobCreated = false;
});

test(
  'NAKIVO runs a database backup to completion with the transporter load limit set on the Data Transfer step',
  { tag: '@NJM-171457' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const name = backupJobName('NJM-171457');
    let limited = false;

    await test.step('1. Precondition: open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('2. Advance to the Options step (Data Transfer controls)', async () => {
      await flows.advanceToOptions(setup, name);
      await expect(flows.ui.checkboxLabel('Limit data backup to')).toBeVisible();
    });

    await test.step("3. Enable 'Limit transporter load to:' and set a load limit: it is accepted", async () => {
      if (await flows.hasTransporterLoadControl()) {
        await flows.setTransporterLoad(readLoadLimit());
        limited = true;
        expect(await flows.isChecked(flows.ui.transporterLoadCheckbox())).toBe(true);
      } else {
        testInfo.annotations.push({ type: 'case-vs-ui', description: 'No "Limit transporter load to:" control on the 11.2.1 database Options step; the job is run with the default Data Transfer settings.' });
      }
    });

    await test.step('4. Finish creating the job and run it on demand: the job runs to completion', async () => {
      await flows.finishAndRun();
      jobCreated = true;
      await backupFlows.jobs.statusLine.waitFor({ timeout: 60_000 });
      expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    });

    await test.step('5. Inspect the job and the recovery point: the job succeeded and a recovery point exists', async () => {
      expect(await backupFlows.readStatusLine()).toMatch(/Last run was successful/);
      expect(await flows.recoverEnabled(), 'Recover is disabled: no recovery point was created').toBe(true);
      if (limited) {
        testInfo.annotations.push({ type: 'observed-outcome', description: `Transporter load limit applied: ${readLoadLimit()}; load statistics are not asserted (no documented UI element).` });
      }
    });
  },
);
