import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-154862: "[MSSQL-BK-UI-DT-0002-2] Verify Streams Checkbox Default State".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (wizard opened and cancelled).
// case-vs-ui: Data Transfer is the Options step (Step 4) of the 4-step wizard. The case says the checkbox is unchecked by default; this is asserted exactly as written.
//   The exploration noted the streams input shows 1 on the new-job Options step; whether the checkbox itself is unchecked was not recorded, so a mismatch here is a finding.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7OptionsFlows(page, backupFlows).leaveWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO leaves the concurrent streams checkbox unchecked on a new database backup job',
  { tag: '@NJM-154862' },
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

    await test.step('3. On a new job the streams checkbox is unchecked by default', async () => {
      const checked = await flows.isChecked(flows.ui.checkboxLabel('Limit data backup to'));
      const value = await flows.streamsValue();
      testInfo.annotations.push({ type: 'observed-outcome', description: `Checkbox checked=${checked}; streams input value="${value}"` });
      expect(checked, 'the streams checkbox is checked on a new job').toBe(false);
    });

    await test.step('Ad hoc: the streams input is disabled while the checkbox is unchecked', async () => {
      expect(await flows.isDisabled(backupFlows.wizard.concurrentStreamsField())).toBe(true);
    });
  },
);
