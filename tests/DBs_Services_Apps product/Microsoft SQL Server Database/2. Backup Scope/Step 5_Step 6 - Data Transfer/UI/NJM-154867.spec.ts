import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-154867: "[MSSQL-BK-UI-DT-0002-7] Verify Streams Max Value".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (wizard opened and cancelled).
// case-vs-ui: Data Transfer is the Options step (Step 4) of the 4-step wizard. "Rejected / corrected" is read as: the field does not keep 65 as a valid value.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7OptionsFlows(page, backupFlows).leaveWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO enforces a maximum of 64 in the concurrent streams field',
  { tag: '@NJM-154867' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(300_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const field = () => backupFlows.wizard.concurrentStreamsField();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Data Transfer controls are on Step 4 Options of the 4-step wizard; rejection mechanism not documented.' });

    await test.step('1. Precondition: open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('2. Advance to the Options step', async () => {
      await flows.advanceToOptions(setup);
      await expect(flows.ui.checkboxLabel('Limit data backup to')).toBeVisible();
    });

    await test.step("3. Check the checkbox and enter '65': it is rejected or corrected as above the maximum", async () => {
      await flows.setChecked(flows.ui.checkboxLabel('Limit data backup to'), true);
      await flows.typeStreams('65');
      const value = await flows.streamsValue();
      const invalid = await flows.fieldInvalid(field());
      testInfo.annotations.push({ type: 'observed-outcome', description: `65 -> value="${value}", invalid=${invalid}` });
      expect(value !== '65' || invalid, 'the value 65 is held as a valid value').toBe(true);
    });

    await test.step("4. Enter '64': it is accepted (maximum allowed value)", async () => {
      await flows.typeStreams('64');
      expect(await flows.streamsValue()).toBe('64');
      expect(await flows.fieldInvalid(field())).toBe(false);
    });
  },
);
