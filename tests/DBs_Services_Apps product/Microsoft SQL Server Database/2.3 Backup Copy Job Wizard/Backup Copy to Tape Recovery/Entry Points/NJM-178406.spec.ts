import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../../flows/bkA7-tape.flows';
import { readTapeLibrary, readTapeSqlBackup } from '../../../../../../helpers/bkA7-env';

// NJM-178406: "Verify tape recovery can be initiated from the Tape tab cartridge contents".
// Env (.env, owner-supplied): NAKIVO_BK_TAPE_LIBRARY, NAKIVO_BK_TAPE_SQL_BACKUP (a SQL database backup already on a cartridge of that library). Without them, or when the backup is not listed, the test ends ABORTED.
// Side effects: none (the tape recovery wizard is opened and cancelled; no job is created).
// case-vs-ui: UNVERIFIED (Tape tab contents, recover option and tape recovery wizard never opened live; text based locators, pages/bkA7-tape.page.ts). "Configuration > Tape" is Settings > Tape. Status IMPLEMENTED_ENV_GATED.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7TapeFlows(page, backupFlows).cancelWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO starts a tape recovery from the cartridge contents of the Tape tab',
  { tag: '@NJM-178406' },
  async ({ signedIn: _s, page, backupFlows }) => {
    test.setTimeout(900_000);
    const tape = readTapeLibrary();
    const backup = readTapeSqlBackup();
    const flows = new BkA7TapeFlows(page, backupFlows);

    await test.step('1. Confirm a SQL database backup has been written to a cartridge in the library', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
    });

    await test.step('2. Navigate to Settings > Tape, select the library and open the cartridge contents: the SQL database backup is listed', async () => {
      const rows = await flows.openTapeResource(tape.library);
      expect(rows.join('\n'), 'the SQL database backup is not listed in the cartridge contents').toContain(backup);
    });

    await test.step('3. Select the SQL database backup entry: a recover option is available', async () => {
      await flows.ui.contentRow(backup).click({ timeout: 15_000 });
      await expect(flows.ui.recoverButton()).toBeVisible();
      expect(await flows.isDisabled(flows.ui.recoverButton()), 'the Recover option is disabled for the selected backup').toBe(false);
    });

    await test.step('4. Launch the recover option: the tape recovery job wizard opens for the selected backup', async () => {
      await flows.ui.recoverButton().click({ timeout: 10_000 });
      await flows.chooseRecoverToRepository();
      await expect(flows.ui.recoveryWizardTitle()).toBeVisible();
    });
  },
);
