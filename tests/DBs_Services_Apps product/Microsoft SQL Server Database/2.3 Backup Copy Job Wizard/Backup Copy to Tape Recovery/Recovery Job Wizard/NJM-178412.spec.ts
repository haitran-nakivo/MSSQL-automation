import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7RecoverFlows } from '../../../../../../flows/bkA7-recover.flows';
import { BkA7TapeFlows } from '../../../../../../flows/bkA7-tape.flows';
import { readRecoveryConfirmed, readSecondaryRepo, readTapeLibrary, readTapeSqlBackup } from '../../../../../../helpers/bkA7-env';

// NJM-178412: "[MSSQL-BKC-TR-02] Verify a recovered database backup follows standard tape-recovery behavior and is usable for normal recovery".
// Env (.env, owner-supplied): NAKIVO_BK_TAPE_LIBRARY, NAKIVO_BK_TAPE_SQL_BACKUP (a SQL backup already on that library), NAKIVO_BK_REPO_SECONDARY (destination), and, only for steps 5-6, NAKIVO_BK_RECOVERY_CONFIRMED = yes
//   (the owner confirms the standard Recover wizard defaults are safe for the lab; when it is not "yes" steps 5-6 are recorded as skipped). Without the tape variables the test ends ABORTED.
// Side effects: runs one tape recovery job that writes the backup into NAKIVO_BK_REPO_SECONDARY (it stays there); with the flag, starts one standard recovery from that backup.
// case-vs-ui: UNVERIFIED (tape recovery wizard, repository Backups row actions and the standard Recover wizard never opened live). The standard recovery is started from the repository Backups list (row ... > Recover, Observed
//   in the notes) and is walked generically. Verifying the recovered database content is not automated (needs a query outside the UI). Status PARTIAL.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7TapeFlows(page, backupFlows).cancelWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO recovers a SQL database backup from tape to a repository and the recovered backup is usable for normal recovery',
  { tag: '@NJM-178412' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(5_400_000);
    const tape = readTapeLibrary();
    const backup = readTapeSqlBackup();
    const repo = readSecondaryRepo();
    const flows = new BkA7TapeFlows(page, backupFlows);
    const recover = new BkA7RecoverFlows(page, backupFlows);
    const RECOVERY_ROW = /recover/i;
    let before = '';

    await test.step('1. Confirm the SQL backup is on tape in the library and the target repository exists', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      const rows = await flows.openTapeResource(tape.library);
      if (!rows.join('\n').includes(backup)) throw new Error(`ABORTED: the backup "${backup}" is not listed on the library`);
    });

    await test.step('2. Run the tape Recovery Job Wizard to recover the backup to the secondary repository and complete the wizard: the tape recovery job is created', async () => {
      await recover.openActivities();
      before = await recover.newestActivityText(RECOVERY_ROW);
      await flows.openTapeResource(tape.library);
      await flows.openRecoverMenuFor(backup);
      await flows.chooseRecoverToRepository();
      const done = await flows.completeTapeRecovery(backup, repo, true);
      expect(done.submitted, 'the wizard did not reach its final button').toBe(true);
    });

    await test.step('3. Run the job and wait for it to finish: it completes successfully', async () => {
      await recover.openActivities();
      const result = await recover.waitActivity(RECOVERY_ROW, before, 3_000_000);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery activity: ${result.row}` });
      expect(result.outcome).toBe('Completed');
    });

    await test.step('4. Open the secondary repository and inspect the recovered backup: it is listed as a normal SQL database backup', async () => {
      const row = await recover.repositoryBackupRowText(repo, backup);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Repository Backups row: "${row}"` });
      expect(row, 'the recovered backup is not listed in the repository').not.toBe('');
    });

    await test.step('5. Initiate a standard SQL recovery using the recovered backup: the recovery wizard accepts it as a source', async () => {
      if (!readRecoveryConfirmed()) {
        testInfo.annotations.push({ type: 'observed-outcome', description: 'Skipped: NAKIVO_BK_RECOVERY_CONFIRMED is not "yes".' });
        return;
      }
      const row = recover.ui.repositoryBackupRow(backup);
      await row.hover({ timeout: 10_000 });
      await row.locator('xpath=.//*[normalize-space(text())="..." or contains(@class,"action") or contains(@class,"more")]').last().click({ timeout: 10_000 });
      await page.getByText('Recover', { exact: true }).filter({ visible: true }).last().click({ timeout: 10_000 });
      await expect(recover.ui.wizardTitle()).toBeVisible({ timeout: 30_000 });
    });

    await test.step('6. Complete the standard recovery and verify the result: it completes (content check not automated)', async () => {
      if (!readRecoveryConfirmed()) return;
      await recover.openActivities();
      const baseline = await recover.newestActivityText(RECOVERY_ROW);
      // The wizard opened in step 5 was left by the navigation above: open it again from the repository row.
      await recover.repositoryBackupRowText(repo, backup);
      const row = recover.ui.repositoryBackupRow(backup);
      await row.hover({ timeout: 10_000 });
      await row.locator('xpath=.//*[normalize-space(text())="..." or contains(@class,"action") or contains(@class,"more")]').last().click({ timeout: 10_000 });
      await page.getByText('Recover', { exact: true }).filter({ visible: true }).last().click({ timeout: 10_000 });
      const run = await recover.walkWizard({ submit: true });
      expect(run.submitted, 'the standard recovery wizard did not reach its final button').toBe(true);
      const result = await recover.waitActivity(RECOVERY_ROW, baseline, 3_000_000);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Standard recovery activity: ${result.row}` });
      expect(result.outcome).toBe('Completed');
    });
  },
);
