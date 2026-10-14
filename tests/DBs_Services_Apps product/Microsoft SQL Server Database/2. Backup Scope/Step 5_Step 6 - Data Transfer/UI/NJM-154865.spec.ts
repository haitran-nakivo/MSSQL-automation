import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-154865: "[MSSQL-BK-UI-DT-0002-5] Verify Streams Numeric Validation".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (wizard opened and cancelled).
// case-vs-ui: Data Transfer is the Options step (Step 4) of the 4-step wizard. "Rejected" is read as: the field never holds the typed text as a valid value
//   (the character is not accepted, or the field is marked invalid). The exact way the product rejects it (mask vs error) was not documented; it is attached as observed-outcome.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7OptionsFlows(page, backupFlows).leaveWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO accepts only whole numbers in the concurrent streams field',
  { tag: '@NJM-154865' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(300_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const field = () => backupFlows.wizard.concurrentStreamsField();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Data Transfer controls are on Step 4 Options of the 4-step wizard; rejection mechanism (mask or error) not documented.' });

    await test.step('1. Precondition: open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('2. Advance to the Options step', async () => {
      await flows.advanceToOptions(setup);
      await expect(flows.ui.checkboxLabel('Limit data backup to')).toBeVisible();
    });

    await test.step("3. Check the checkbox and enter 'abc': alphabetic characters are rejected", async () => {
      await flows.setChecked(flows.ui.checkboxLabel('Limit data backup to'), true);
      await flows.typeStreams('abc');
      const value = await flows.streamsValue();
      const invalid = await flows.fieldInvalid(field());
      testInfo.annotations.push({ type: 'observed-outcome', description: `abc -> value="${value}", invalid=${invalid}` });
      expect(value).not.toMatch(/[a-zA-Z]/);
    });

    await test.step("4. Enter '1.5': the non-integer value is rejected", async () => {
      await flows.typeStreams('1.5');
      const value = await flows.streamsValue();
      const invalid = await flows.fieldInvalid(field());
      testInfo.annotations.push({ type: 'observed-outcome', description: `1.5 -> value="${value}", invalid=${invalid}` });
      expect(value !== '1.5' || invalid, 'the fractional value 1.5 is held as a valid value').toBe(true);
    });

    await test.step("5. Enter '10': the integer value is accepted", async () => {
      await flows.typeStreams('10');
      expect(await flows.streamsValue()).toBe('10');
      expect(await flows.fieldInvalid(field())).toBe(false);
    });
  },
);
