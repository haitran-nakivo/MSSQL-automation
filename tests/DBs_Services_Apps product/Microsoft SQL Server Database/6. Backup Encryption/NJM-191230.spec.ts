import { test, expect } from '../../../../fixtures';
import { RUN_OPTIONS } from '../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../flows/bkA7-options.flows';
import { BkA7RecoverFlows } from '../../../../flows/bkA7-recover.flows';
import { backupJobName } from '../../../../helpers/backup-env';
import { readA7Setup, readRecoveryConfirmed } from '../../../../helpers/bkA7-env';

// NJM-191230: "ENC-07 - Recovery from an encrypted backup (correct vs. wrong password)".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, and NAKIVO_BK_RECOVERY_CONFIRMED = yes (the owner confirms that the Recover wizard defaults
//   are safe for the lab: the wizard was never explored, so the spec cannot choose a "recover to a new database" target and a default could overwrite the source database; without it the test ends ABORTED).
// Side effects: creates job NJM-191230 (runs once) and a saved password with Description "NJM-191230 <timestamp>"; starts up to three recovery runs through the Recover wizard (steps 1-3, 5, 6).
//   afterEach deletes the job with its backups and the password (already deleted in step 5).
// case-vs-ui: the Recover wizard is UNVERIFIED (pages/bkA7-recover.page.ts): it is walked generically with Next until its final button, a password is typed only when a password input appears. Step 3 (compare
//   the recovered content with the source) and step 4 (search the backup files on the repository host for a known string) are NOT automated: they need a database query / file access outside the UI, so
//   the case is PARTIAL. Steps 5 and 6 accept either "blocked in the wizard" or "the recovery job Failed" and require a password message ("password required / incorrect") to be shown when the UI shows one.
test.use(RUN_OPTIONS);

const KEY = 'NJM-191230';
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
  'NAKIVO recovers an encrypted backup with its password and refuses recovery when the password is missing or wrong',
  { tag: '@NJM-191230' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(1_800_000);
    if (!readRecoveryConfirmed()) throw new Error('ABORTED: NAKIVO_BK_RECOVERY_CONFIRMED is not "yes"; the Recover wizard defaults were not confirmed safe for the lab');
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const recover = new BkA7RecoverFlows(page, backupFlows);
    const name = backupJobName(KEY);
    const description = `${KEY} ${Date.now()}`;
    const password = `Nj${Date.now()}-Aa1!r`;
    const RECOVERY_ROW = /recover/i;

    await test.step('Precondition: a job with Backup encryption = Enabled (new password) has run once to Successful', async () => {
      await flows.openOptionsStep(setup, name);
      await flows.enableBackupEncryption();
      await flows.openSetPassword();
      passwordCreated = true;
      expect(await flows.createPassword({ password, description })).toBe(true);
      await flows.finishAndRun();
      jobCreated = true;
      await expect(backupFlows.jobs.statusLine).toBeVisible({ timeout: 60_000 });
      expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    });

    await test.step('1. Data Protection > Recover: start a recovery from this job\'s recovery point', async () => {
      await backupFlows.openJob(name);
      expect(await recover.openRecover(), 'the Recover wizard did not open (UNVERIFIED locators)').toBe(true);
    });

    await test.step('2. Complete the recovery wizard (password supplied if prompted) and run the recovery: it completes Successful', async () => {
      await recover.openActivities();
      const before = await recover.newestActivityText(RECOVERY_ROW);
      await backupFlows.openJob(name);
      await recover.openRecover();
      const run = await recover.walkWizard({ password, submit: true });
      testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery wizard: steps=${run.steps}, passwordPrompted=${run.passwordPrompted}, submitted=${run.submitted}` });
      expect(run.submitted, 'the recovery wizard did not reach its final button').toBe(true);
      const result = await recover.waitActivity(RECOVERY_ROW, before, 900_000);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery activity: ${result.row}` });
      expect(result.outcome).toBe('Completed');
    });

    await test.step('3. Open the recovered item and compare its content with the source (NOT AUTOMATED: needs a database query outside the UI)', async () => {
      testInfo.annotations.push({ type: 'observed-outcome', description: 'Content comparison not automated; the recovery job result is asserted in step 2.' });
    });

    await test.step('4. Inspect the backup files on the repository host for the known string (NOT AUTOMATED: file access on the repository host is outside the UI)', async () => {
      testInfo.annotations.push({ type: 'observed-outcome', description: 'Data-at-rest plaintext check not automated.' });
    });

    await test.step('5. In Manage passwords delete the password used, then attempt recovery again: it is blocked with a password required / missing message', async () => {
      expect(await flows.deletePasswordsViaJob(name, KEY), 'the saved password was not found to delete').toBeGreaterThan(0);
      passwordCreated = false;
      await recover.openActivities();
      const before = await recover.newestActivityText(RECOVERY_ROW);
      await backupFlows.openJob(name);
      await recover.openRecover();
      const run = await recover.walkWizard({ submit: true });
      testInfo.annotations.push({ type: 'observed-outcome', description: `No stored password: passwordPrompted=${run.passwordPrompted}, submitted=${run.submitted}, password texts=${JSON.stringify(run.passwordMessages)}` });
      let blocked = !run.submitted;
      if (run.submitted) {
        const result = await recover.waitActivity(RECOVERY_ROW, before, 900_000);
        testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery activity: ${result.row}` });
        blocked = result.outcome === 'Failed';
      }
      expect(blocked || run.passwordPrompted, 'recovery ran without a password after the stored password was deleted').toBe(true);
      expect(run.passwordMessages.length > 0 || run.passwordPrompted, 'no password-required message or prompt was shown').toBe(true);
    });

    await test.step('6. Attempt recovery supplying a deliberately wrong password: it fails with an incorrect-password error and the backup stays intact', async () => {
      await recover.cancelWizard();
      await recover.openActivities();
      const before = await recover.newestActivityText(RECOVERY_ROW);
      await backupFlows.openJob(name);
      await recover.openRecover();
      const run = await recover.walkWizard({ password: 'Wrong-Password-0000!', submit: true });
      testInfo.annotations.push({ type: 'observed-outcome', description: `Wrong password: passwordPrompted=${run.passwordPrompted}, submitted=${run.submitted}, texts=${JSON.stringify(run.passwordMessages)}` });
      let failed = !run.submitted;
      if (run.submitted) {
        const result = await recover.waitActivity(RECOVERY_ROW, before, 900_000);
        testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery activity: ${result.row}` });
        failed = result.outcome === 'Failed';
      }
      expect(failed, 'recovery with a wrong password did not fail').toBe(true);
      const texts = run.passwordMessages.join(' ');
      if (texts) expect(texts).toMatch(/incorrect|wrong|invalid|does not match|required/i);
      const row = await recover.repositoryBackupRowText(setup.repo, name);
      expect(row, 'the backup disappeared from the repository').not.toBe('');
    });
  },
);
