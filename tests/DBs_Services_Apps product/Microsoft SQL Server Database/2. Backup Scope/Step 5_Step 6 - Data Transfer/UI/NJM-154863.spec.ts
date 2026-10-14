import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-154863: "[MSSQL-BK-UI-DT-0002-3] Verify Input Field Enablement".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (wizard opened and cancelled).
// case-vs-ui: Data Transfer is the Options step (Step 4) of the 4-step wizard. The number input is enabled only when the checkbox is ticked (Observed).
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7OptionsFlows(page, backupFlows).leaveWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO enables the streams number input when the checkbox is checked and disables it when unchecked',
  { tag: '@NJM-154863' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(300_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const label = () => flows.ui.checkboxLabel('Limit data backup to');
    const field = () => backupFlows.wizard.concurrentStreamsField();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Data Transfer controls are on Step 4 Options of the 4-step wizard.' });

    await test.step('1. Precondition: open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('2. Advance to the Options step', async () => {
      await flows.advanceToOptions(setup);
      await expect(label()).toBeVisible();
    });

    await test.step('Ad hoc: before any action the number input is disabled', async () => {
      await flows.setChecked(label(), false);
      expect(await flows.isDisabled(field())).toBe(true);
    });

    await test.step('3. Check the streams checkbox: the number input becomes enabled and editable', async () => {
      await label().click({ timeout: 10_000 });
      expect(await flows.isChecked(label())).toBe(true);
      await expect(field()).toBeEnabled();
      await expect(field()).toBeEditable();
    });

    await test.step('4. Uncheck the streams checkbox: the number input becomes disabled', async () => {
      await label().click({ timeout: 10_000 });
      expect(await flows.isChecked(label())).toBe(false);
      expect(await flows.isDisabled(field())).toBe(true);
    });
  },
);
