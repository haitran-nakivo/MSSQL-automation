import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../../flows/bkA7-tape.flows';
import { readSecondaryRepo, readTapeLibrary, readTapeSqlBackup } from '../../../../../../helpers/bkA7-env';

// NJM-178410: "Verify Step 2 destination allows repository selection and disables SaaS repositories".
// Env (.env, owner-supplied): NAKIVO_BK_TAPE_LIBRARY, NAKIVO_BK_TAPE_SQL_BACKUP (a SQL backup already on that library), NAKIVO_BK_REPO_SECONDARY (a non-SaaS repository used as the destination). Without them the test ends ABORTED.
// Side effects: none (the tape recovery wizard is opened and cancelled; no job is created).
// case-vs-ui: UNVERIFIED (wizard never opened live). SaaS repositories are recognised by "SaaS" in the row text; if the Director has none, that step records it as observed-outcome and asserts nothing (a SaaS repository
//   cannot be created by the test). Status IMPLEMENTED_ENV_GATED.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7TapeFlows(page, backupFlows).cancelWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO lets the tape recovery wizard pick a repository destination and disables SaaS repositories',
  { tag: '@NJM-178410' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    const tape = readTapeLibrary();
    const backup = readTapeSqlBackup();
    const repo = readSecondaryRepo();
    const flows = new BkA7TapeFlows(page, backupFlows);

    await test.step('1. With the SQL database backup selected in Step 1, proceed to Step 2 (Destination)', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      const rows = await flows.openTapeResource(tape.library);
      if (!rows.join('\n').includes(backup)) throw new Error(`ABORTED: the backup "${backup}" is not listed on the library`);
      await flows.openRecoverMenuFor(backup);
      await flows.chooseRecoverToRepository();
      if (await flows.isDisabled(flows.ui.nextButton())) await flows.selectWizardRow(backup);
      await flows.next();
      await expect(flows.ui.wizardRow(repo)).toBeVisible({ timeout: 30_000 });
    });

    await test.step('2. Inspect the repository list: repositories that can be the recovery target are listed', async () => {
      const rows = await flows.wizardRows();
      testInfo.annotations.push({ type: 'observed-outcome', description: `Step 2 rows with disabled flag: ${JSON.stringify(rows)}` });
      expect(rows.length).toBeGreaterThan(0);
      const mine = rows.find((r) => r.text.includes(repo));
      expect(mine?.disabled, 'the destination repository is shown disabled').toBe(false);
    });

    await test.step('3. Inspect the SaaS repositories in the destination list: they are disabled and cannot be selected', async () => {
      const saas = (await flows.wizardRows()).filter((r) => /saas/i.test(r.text));
      if (saas.length === 0) {
        testInfo.annotations.push({ type: 'observed-outcome', description: 'No SaaS repository is configured on this Director; nothing to assert.' });
        return;
      }
      for (const row of saas) expect(row.disabled, `SaaS repository row is enabled: ${row.text}`).toBe(true);
    });

    await test.step('4. Select the non-SaaS repository as the destination: it is selected and the wizard can proceed', async () => {
      await flows.selectWizardRow(repo);
      expect(await flows.isDisabled(flows.ui.nextButton())).toBe(false);
    });
  },
);
