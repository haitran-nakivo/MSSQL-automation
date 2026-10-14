import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../../flows/bkA7-tape.flows';
import { readTapeLibrary, readTapeSqlBackup } from '../../../../../../helpers/bkA7-env';

// NJM-178409: "Verify Step 1 lists database backups on tape and disables inappropriate types".
// Env (.env, owner-supplied): NAKIVO_BK_TAPE_LIBRARY, NAKIVO_BK_TAPE_SQL_BACKUP (a SQL database backup already on tape; the library should also hold other, non-recoverable backup types). Without them the test ends ABORTED.
// Side effects: none (the tape recovery wizard is opened and cancelled; no job is created).
// case-vs-ui: UNVERIFIED (the tape recovery wizard was never opened live; rows are read as grid / list rows with a disabled flag from the class names). The case does not say which rows are "inappropriate": the spec asserts
//   that the SQL database backup is listed, enabled and selectable (Next becomes enabled) and attaches every row with its disabled flag as observed-outcome; when the wizard shows any disabled row the spec records it, it
//   does not decide which type it should be. Status PARTIAL.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7TapeFlows(page, backupFlows).cancelWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO lists SQL database backups on tape in Step 1 of the tape recovery wizard and keeps them selectable',
  { tag: '@NJM-178409' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    const tape = readTapeLibrary();
    const backup = readTapeSqlBackup();
    const flows = new BkA7TapeFlows(page, backupFlows);

    await test.step('1. Confirm the library holds SQL database backups (and other backup types)', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      const rows = await flows.openTapeResource(tape.library);
      if (!rows.join('\n').includes(backup)) throw new Error(`ABORTED: the backup "${backup}" is not listed on the library`);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Cartridge rows: ${JSON.stringify(rows)}` });
    });

    await test.step('2. Open the tape Recovery Job Wizard and view Step 1: the SQL database backups on tape are listed', async () => {
      await flows.openRecoverMenuFor(backup);
      await flows.chooseRecoverToRepository();
      await expect(flows.ui.recoveryWizardTitle()).toBeVisible();
      await expect(flows.ui.wizardRow(backup)).toBeVisible();
    });

    await test.step('3. Inspect the inappropriate backup types in the Step 1 list: they are shown disabled', async () => {
      const rows = await flows.wizardRows();
      testInfo.annotations.push({ type: 'observed-outcome', description: `Step 1 rows with disabled flag: ${JSON.stringify(rows)}` });
      const mine = rows.find((r) => r.text.includes(backup));
      expect(mine, 'the SQL backup row was not read').toBeDefined();
      expect(mine?.disabled, 'the SQL database backup is shown disabled').toBe(false);
    });

    await test.step('4. Select the SQL database backup in Step 1: it is selected and Next is enabled', async () => {
      if (await flows.isDisabled(flows.ui.nextButton())) await flows.selectWizardRow(backup);
      expect(await flows.isDisabled(flows.ui.nextButton()), 'Next is disabled after selecting the SQL backup').toBe(false);
    });
  },
);
