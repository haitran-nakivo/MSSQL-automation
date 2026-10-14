import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../../flows/bkA7-tape.flows';
import { readTapeLibrary, readTapeSqlBackup } from '../../../../../../helpers/bkA7-env';

// NJM-178408: "Verify database backup tape-recovery option appears in Global Search".
// Env (.env, owner-supplied): NAKIVO_BK_TAPE_LIBRARY, NAKIVO_BK_TAPE_SQL_BACKUP (a SQL database backup already on tape; its name is searched). Without them, or when the backup is not on the library, the test ends ABORTED.
// Side effects: none (the tape recovery wizard is opened and cancelled; no job is created).
// case-vs-ui: UNVERIFIED (Global Search box, its result rows and their actions were never explored; the box is located as the first visible input whose placeholder mentions Search, results and the recover action by text).
//   The tape-recovery option is looked for as a visible text containing "Recover" next to the result; its exact label is attached as observed-outcome. Status IMPLEMENTED_ENV_GATED.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7TapeFlows(page, backupFlows).cancelWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO offers the tape recovery option for a database backup found in Global Search',
  { tag: '@NJM-178408' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    const tape = readTapeLibrary();
    const backup = readTapeSqlBackup();
    const flows = new BkA7TapeFlows(page, backupFlows);

    await test.step('1. Confirm a SQL database backup exists on tape in the library', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      const rows = await flows.openTapeResource(tape.library);
      if (!rows.join('\n').includes(backup)) throw new Error(`ABORTED: the backup "${backup}" is not listed on the library`);
    });

    await test.step('2. Open Global Search and search for the SQL database backup name: the result for the backup on tape is listed', async () => {
      await flows.globalSearch(backup);
      await expect(flows.ui.searchResult(backup)).toBeVisible({ timeout: 30_000 });
    });

    await test.step('3. Inspect the actions offered on the tape backup result: a tape-recovery option is offered', async () => {
      await flows.ui.searchResult(backup).hover({ timeout: 10_000 });
      const actions = await backupFlows.visibleTexts();
      const recoverTexts = actions.filter((t) => /recover/i.test(t));
      testInfo.annotations.push({ type: 'observed-outcome', description: `Texts with "recover" visible on the search result: ${JSON.stringify(recoverTexts)}` });
      expect(recoverTexts.length, 'no recover option is shown for the tape backup result').toBeGreaterThan(0);
    });

    await test.step('4. Launch the tape-recovery option from the result: the tape recovery job wizard opens', async () => {
      await flows.ui.recoverButton().click({ timeout: 10_000 });
      if ((await flows.ui.recoverToRepositoryItem().count()) > 0) await flows.ui.recoverToRepositoryItem().click({ timeout: 10_000 });
      await expect(flows.ui.recoveryWizardTitle()).toBeVisible({ timeout: 30_000 });
    });
  },
);
