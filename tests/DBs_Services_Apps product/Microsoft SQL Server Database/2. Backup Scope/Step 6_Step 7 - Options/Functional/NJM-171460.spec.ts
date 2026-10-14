import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { backupJobName, readBackupDatabase } from '../../../../../../helpers/backup-env';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-171460: "Backup - Step 6/Step 7 - Options - Run multiple job with differents Job priority".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (job 1, priority 1 = highest), NAKIVO_BK_INSTANCE_DB_FULL (job 2, priority 5 = lowest; a second
//   database so the two jobs do not back up the same database at once), NAKIVO_BK_REPO_PRIMARY.
// Side effects: creates jobs NJM-171460-high and NJM-171460-low (both deleted in afterEach, backups kept); runs each once.
// case-vs-ui: Data Protection > + > Backup for Database, Options step is Step 4; priority is a 1-5 combo (1 highest, tooltip), not "high / low". The two jobs are started one after the other
//   (low first, then high) so they compete for the same transporter. The processing order is attached as observed-outcome; it is NOT asserted, because jobs may run in parallel when the transporter has
//   free capacity, and the notes do not say how the UI shows the order. Status PARTIAL.
test.use(RUN_OPTIONS);

const created: string[] = [];

test.afterEach(async ({ backupFlows }) => {
  for (const name of created) {
    try {
      await backupFlows.discardJobIfPresent(name);
    } catch {
      // best effort
    }
  }
  created.length = 0;
});

test(
  'NAKIVO saves a distinct Job priority per database backup job and completes concurrently started jobs',
  { tag: '@NJM-171460' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(1_200_000);
    const first = readA7Setup();
    const second = { ...first, db: readBackupDatabase('INSTANCE', 'FULL') };
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const high = backupJobName('NJM-171460', '-high');
    const low = backupJobName('NJM-171460', '-low');

    await test.step('1. Precondition: two database backup jobs that can run concurrently are created (On demand, one database each)', async () => {
      await flows.createJob(first, high, { priority: 1 });
      created.push(high);
      await flows.createJob(second, low, { priority: 5 });
      created.push(low);
      await expect(backupFlows.jobs.statusLine).toBeVisible();
    });

    await test.step('2. Each job is saved with its distinct Job priority', async () => {
      await flows.openEditOptions(high);
      expect(await flows.comboValue('Job priority')).toBe('1');
      await flows.leaveWizard();
      await flows.openEditOptions(low);
      expect(await flows.comboValue('Job priority')).toBe('5');
      await flows.leaveWizard();
    });

    await test.step('3. Start the jobs so they compete for the same transporter: both start processing', async () => {
      await backupFlows.openJob(low);
      await backupFlows.runOpenJob();
      await backupFlows.openJob(high);
      await backupFlows.runOpenJob();
      await expect(backupFlows.jobs.statusLine).toBeVisible();
    });

    await test.step('4. Monitor the jobs: all complete successfully and their recovery points exist', async () => {
      expect(await backupFlows.waitForResult(900_000), 'the high priority job did not finish successfully').toBe('successful');
      expect(await flows.recoverEnabled()).toBe(true);
      await backupFlows.openJob(low);
      expect(await backupFlows.waitForResult(900_000), 'the low priority job did not finish successfully').toBe('successful');
      expect(await flows.recoverEnabled()).toBe(true);
      const events = await flows.pageTextsMatching(/started|has finished|processing/i);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Low priority job events: ${JSON.stringify(events)}; processing order is not asserted (see header).` });
    });
  },
);
