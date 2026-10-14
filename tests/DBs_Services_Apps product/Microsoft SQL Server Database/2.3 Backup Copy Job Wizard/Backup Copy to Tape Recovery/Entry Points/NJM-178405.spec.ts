import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7RecoverFlows } from '../../../../../../flows/bkA7-recover.flows';
import { BkA7TapeFlows } from '../../../../../../flows/bkA7-tape.flows';
import { readSecondaryRepo, readTapeLibrary, readTapeSqlBackup } from '../../../../../../helpers/bkA7-env';

// NJM-178405: "[MSSQL-BKC-TR-01] Verify individual SQL database backup can be recovered from tape to a repository via Recover menu".
// Env (.env, owner-supplied): NAKIVO_BK_TAPE_LIBRARY (library holding the backup), NAKIVO_BK_TAPE_SQL_BACKUP (name of a SQL database backup that is ALREADY on tape, as the cartridge contents list it),
//   NAKIVO_BK_REPO_SECONDARY (the repository that receives the recovered backup). Without them, or when the backup is not listed on the library, the test ends ABORTED.
// Side effects: runs one tape recovery job that writes the backup into NAKIVO_BK_REPO_SECONDARY; the recovered backup stays there (it is owner-supplied lab storage; it is not deleted by the test).
// case-vs-ui: UNVERIFIED (Tape tab, the Recover menu entry "Recover backup to repository" and the tape recovery wizard were never opened live; locators are text based, pages/bkA7-tape.page.ts). The recovery
//   job's result is read from Activities (route /c/activities, Observed) by the newest row whose name mentions "recover". Status IMPLEMENTED_ENV_GATED.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7TapeFlows(page, backupFlows).cancelWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO recovers an individual SQL database backup from tape to a repository through the Recover menu',
  { tag: '@NJM-178405' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(3_600_000);
    const tape = readTapeLibrary();
    const backup = readTapeSqlBackup();
    const repo = readSecondaryRepo();
    const flows = new BkA7TapeFlows(page, backupFlows);
    const recover = new BkA7RecoverFlows(page, backupFlows);
    const RECOVERY_ROW = /recover/i;
    let before = '';

    await test.step('1. Confirm the SQL database backup exists on tape in the library and the target repository exists', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      const rows = await flows.openTapeResource(tape.library);
      if (!rows.join('\n').includes(backup)) throw new Error(`ABORTED: the backup "${backup}" is not listed on the library "${tape.library}"`);
    });

    await test.step('2. Select the SQL database backup and choose Recover > Recover backup to repository: the tape recovery wizard opens', async () => {
      await flows.openRecoverMenuFor(backup);
      await flows.chooseRecoverToRepository();
      await expect(flows.ui.recoveryWizardTitle()).toBeVisible();
    });

    await test.step('3. Select the secondary repository as the destination and finish the wizard: the tape recovery job is created', async () => {
      await recover.openActivities();
      before = await recover.newestActivityText(RECOVERY_ROW);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Newest recovery activity before: "${before}"` });
      await flows.openTapeResource(tape.library);
      await flows.openRecoverMenuFor(backup);
      await flows.chooseRecoverToRepository();
      const done = await flows.completeTapeRecovery(backup, repo, true);
      expect(done.submitted, 'the wizard did not reach its final button').toBe(true);
    });

    await test.step('4. Run the job and open its progress in Activities: it reads from tape, writes to the repository and completes successfully', async () => {
      await recover.openActivities();
      const result = await recover.waitActivity(RECOVERY_ROW, before, 3_000_000);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery activity: ${result.row}` });
      expect(result.outcome).toBe('Completed');
    });

    await test.step('5. Open the secondary repository: the recovered SQL database backup is listed', async () => {
      const row = await recover.repositoryBackupRowText(repo, backup);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Repository Backups row: "${row}"` });
      expect(row, 'the recovered backup is not listed in the repository').not.toBe('');
    });
  },
);
