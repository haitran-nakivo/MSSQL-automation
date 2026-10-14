import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-154868: "[MSSQL-BK-UI-DT-0002-8] Verify Streams Input Default".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (wizard opened and cancelled).
// case-vs-ui: Data Transfer is the Options step (Step 4) of the 4-step wizard. The exploration saw the input showing 1 on a new job (Observed).
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7OptionsFlows(page, backupFlows).leaveWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO pre-fills the concurrent streams field with 1',
  { tag: '@NJM-154868' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(300_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Data Transfer controls are on Step 4 Options of the 4-step wizard.' });

    await test.step('1. Precondition: open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('2. Advance to the Options step', async () => {
      await flows.advanceToOptions(setup);
      await expect(flows.ui.checkboxLabel('Limit data backup to')).toBeVisible();
    });

    await test.step("3. Check the streams checkbox: the initial value of the streams field is '1'", async () => {
      await flows.setChecked(flows.ui.checkboxLabel('Limit data backup to'), true);
      await expect(backupFlows.wizard.concurrentStreamsField()).toBeEnabled();
      expect(await flows.streamsValue()).toBe('1');
    });
  },
);
