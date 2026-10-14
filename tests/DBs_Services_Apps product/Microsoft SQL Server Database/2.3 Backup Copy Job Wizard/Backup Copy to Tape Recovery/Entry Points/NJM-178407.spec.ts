import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../../flows/bkA7-tape.flows';
import { readNoRepositoryFlag, readTapeLibrary, readTapeSqlBackup } from '../../../../../../helpers/bkA7-env';

// NJM-178407: "Verify Recover backup to repository is disabled when no repositories available".
// Env (.env, owner-supplied): NAKIVO_BK_TAPE_LIBRARY, NAKIVO_BK_TAPE_SQL_BACKUP (a SQL backup already on that library) and NAKIVO_BK_TAPE_NO_REPOSITORY = yes, with which the owner states that THIS Director has no repository
//   that can be a recovery target (only tape). The test never removes a repository; without the flag it ends ABORTED.
// Side effects: none (the Recover menu is opened and closed).
// case-vs-ui: UNVERIFIED (Recover menu on the Tape tab, disabled state and hint text never seen live). The hint is read from the Ext tooltip (.x-tip) on hover and must mention a repository. Status IMPLEMENTED_ENV_GATED.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page }) => {
  try {
    await page.keyboard.press('Escape');
  } catch {
    // best effort
  }
});

test(
  'NAKIVO disables Recover backup to repository and explains why when no repository is available',
  { tag: '@NJM-178407' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    if (!readNoRepositoryFlag()) throw new Error('ABORTED: NAKIVO_BK_TAPE_NO_REPOSITORY is not "yes"; this case needs a Director without a repository');
    const tape = readTapeLibrary();
    const backup = readTapeSqlBackup();
    const flows = new BkA7TapeFlows(page, backupFlows);

    await test.step('1. Ensure no repository is available as a tape-recovery target (only tape): confirmed by the owner flag, the SQL backup is on tape', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      const rows = await flows.openTapeResource(tape.library);
      if (!rows.join('\n').includes(backup)) throw new Error(`ABORTED: the backup "${backup}" is not listed on the library`);
    });

    await test.step('2. Select the SQL database backup on tape and open the Recover menu: the menu is displayed', async () => {
      await flows.openRecoverMenuFor(backup);
      await expect(flows.ui.recoverToRepositoryItem()).toBeVisible();
    });

    await test.step('3. Inspect the Recover backup to repository option: it is disabled / greyed out', async () => {
      expect(await flows.isDisabled(flows.ui.recoverToRepositoryItem())).toBe(true);
    });

    await test.step('4. Hover over the disabled option: a hint says a repository is required', async () => {
      const hint = await flows.backup.hoverTexts(flows.ui.recoverToRepositoryItem());
      testInfo.annotations.push({ type: 'observed-outcome', description: `Hint texts after hover: ${JSON.stringify(hint)}` });
      expect(hint.join(' ')).toMatch(/repositor/i);
    });
  },
);
