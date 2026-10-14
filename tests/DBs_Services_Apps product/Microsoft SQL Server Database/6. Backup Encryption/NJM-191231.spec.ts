import { test, expect } from '../../../../fixtures';
import { RUN_OPTIONS } from '../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../flows/bkA7-options.flows';
import { BkA7RecoverFlows } from '../../../../flows/bkA7-recover.flows';
import { backupJobName } from '../../../../helpers/backup-env';
import { readA7Setup, readRecoveryConfirmed } from '../../../../helpers/bkA7-env';

// NJM-191231: "ENC-08 - Toggling encryption on an existing job that already has recovery points".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, and NAKIVO_BK_RECOVERY_CONFIRMED = yes (the owner confirms that the Recover wizard defaults are safe
//   for the lab, see NJM-191230; without it the test ends ABORTED).
// Side effects: creates job NJM-191231 (runs four times: two unencrypted, one encrypted, one unencrypted again), a saved password with Description "NJM-191231 <timestamp>", and up to two
//   recovery runs. afterEach deletes the job with its backups and the password.
// case-vs-ui: the Recover wizard is UNVERIFIED and walked generically (see NJM-191230). The wizard offers the NEWEST recovery point by default; the spec does not pick an older point, so step 4 (recover from
//   an OLD pre-encryption point) is NOT automated; steps 5 (newest encrypted point with its password) and 7 (newest point after disabling, no password) are. Run types: the Run dialog offers an "SQL backup type"
//   combo only when a Full run exists and the chain is unchanged; Full is chosen whenever it is offered. Whether the first run after enabling encryption is a new Full is read from the job events and attached
//   (the case allows either). Status PARTIAL.
test.use(RUN_OPTIONS);

const KEY = 'NJM-191231';
let jobCreated = false;
let passwordCreated = false;

test.afterEach(async ({ page, backupFlows }) => {
  const flows = new BkA7OptionsFlows(page, backupFlows);
  try {
    await new BkA7RecoverFlows(page, backupFlows).cancelWizard();
  } catch {
    // best effort
  }
  if (jobCreated) {
    try {
      await backupFlows.discardJobIfPresent(backupJobName(KEY), false);
    } catch {
      // best effort
    }
    jobCreated = false;
  }
  if (passwordCreated) {
    try {
      await flows.cleanupPasswords(readA7Setup(), KEY);
    } catch {
      // best effort
    }
    passwordCreated = false;
  }
});

test(
  'NAKIVO keeps old recovery points recoverable when encryption is switched on and off on an existing job',
  { tag: '@NJM-191231' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(2_400_000);
    if (!readRecoveryConfirmed()) throw new Error('ABORTED: NAKIVO_BK_RECOVERY_CONFIRMED is not "yes"; the Recover wizard defaults were not confirmed safe for the lab');
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const recover = new BkA7RecoverFlows(page, backupFlows);
    const name = backupJobName(KEY);
    const description = `${KEY} ${Date.now()}`;
    const password = `Nj${Date.now()}-Aa1!t`;
    const RECOVERY_ROW = /recover/i;

    const recoverNewest = async (pw: string | undefined) => {
      await recover.openActivities();
      const before = await recover.newestActivityText(RECOVERY_ROW);
      await backupFlows.openJob(name);
      expect(await recover.openRecover(), 'the Recover wizard did not open (UNVERIFIED locators)').toBe(true);
      const run = await recover.walkWizard({ password: pw, submit: true });
      testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery wizard: steps=${run.steps}, passwordPrompted=${run.passwordPrompted}, submitted=${run.submitted}` });
      expect(run.submitted, 'the recovery wizard did not reach its final button').toBe(true);
      const result = await recover.waitActivity(RECOVERY_ROW, before, 900_000);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery activity: ${result.row}` });
      return { run, result };
    };

    await test.step('Precondition: a job with Backup encryption = Disabled has run twice, producing two unencrypted recovery points', async () => {
      await flows.createJob(setup, name);
      jobCreated = true;
      await backupFlows.openJob(name);
      await flows.runJob('Full');
      expect(await backupFlows.waitForResult(600_000)).toBe('successful');
      await flows.runJob('Full');
      expect(await backupFlows.waitForResult(600_000)).toBe('successful');
      const row = await recover.repositoryBackupRowText(setup.repo, name);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Repository Backups row before encryption: "${row}"` });
    });

    await test.step('1. Edit the job > 4. Options > Backup encryption = Enabled, create a new password, Proceed, Save', async () => {
      expect(await flows.enableEncryptionOnJob(name, { password, description })).toBe(true);
      passwordCreated = true;
    });

    await test.step('2. Run the job and wait for completion: Successful', async () => {
      await backupFlows.openJob(name);
      await flows.runJob('Full');
      expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    });

    await test.step('3. Inspect the recovery point list and the job log: events are listed and the job log is attached', async () => {
      const events = await flows.pageTextsMatching(/backup type|full|incremental|differential|encrypt/i);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Job events after enabling encryption: ${JSON.stringify(events)}` });
      const row = await recover.repositoryBackupRowText(setup.repo, name);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Repository Backups row after enabling encryption: "${row}"` });
      expect(row).not.toBe('');
    });

    await test.step('4. Recover from an OLD, pre-encryption recovery point (NOT AUTOMATED: the wizard\'s recovery point selection is not known)', async () => {
      testInfo.annotations.push({ type: 'observed-outcome', description: 'Old recovery point recovery not automated.' });
    });

    await test.step('5. Recover from the new, encrypted recovery point using its password: it completes Successful', async () => {
      const { result } = await recoverNewest(password);
      expect(result.outcome).toBe('Completed');
    });

    await test.step('6. Edit the job > Backup encryption = Disabled > Save, run the job again: Successful', async () => {
      await recover.cancelWizard();
      await flows.disableEncryptionOnJob(name);
      await backupFlows.openJob(name);
      await flows.runJob('Full');
      expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    });

    await test.step('7. Recover from the newest point: it needs no password and completes Successful', async () => {
      const { run, result } = await recoverNewest(undefined);
      expect(run.passwordPrompted, 'the unencrypted recovery point asked for a password').toBe(false);
      expect(result.outcome).toBe('Completed');
    });

    await test.step('8. Check alarms / events and the repository state: the job has no failure events and the backup is still listed', async () => {
      await backupFlows.openJob(name);
      expect(await backupFlows.readStatusLine()).toMatch(/Last run was successful/);
      const row = await recover.repositoryBackupRowText(setup.repo, name);
      expect(row, 'the backup disappeared from the repository').not.toBe('');
    });
  },
);
