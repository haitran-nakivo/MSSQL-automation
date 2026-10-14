import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-154866: "[MSSQL-BK-UI-DT-0002-6] Verify Streams Min Value".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (wizard opened and cancelled).
// case-vs-ui: Data Transfer is the Options step (Step 4) of the 4-step wizard. "Rejected / corrected" is read as: the field does not keep the value as a valid
//   one (it is marked invalid or the value is changed). The exact reaction is attached as observed-outcome.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7OptionsFlows(page, backupFlows).leaveWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO enforces a minimum of 1 in the concurrent streams field',
  { tag: '@NJM-154866' },
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

    await test.step("3. Check the checkbox and enter '0': it is rejected or corrected as below the minimum", async () => {
      await flows.setChecked(flows.ui.checkboxLabel('Limit data backup to'), true);
      await flows.typeStreams('0');
      const value = await flows.streamsValue();
      const invalid = await flows.fieldInvalid(field());
      testInfo.annotations.push({ type: 'observed-outcome', description: `0 -> value="${value}", invalid=${invalid}` });
      expect(value !== '0' || invalid, 'the value 0 is held as a valid value').toBe(true);
    });

    await test.step("4. Enter '-5': the negative value is rejected or corrected", async () => {
      await flows.typeStreams('-5');
      const value = await flows.streamsValue();
      const invalid = await flows.fieldInvalid(field());
      testInfo.annotations.push({ type: 'observed-outcome', description: `-5 -> value="${value}", invalid=${invalid}` });
      expect(value !== '-5' || invalid, 'the negative value -5 is held as a valid value').toBe(true);
    });

    await test.step("5. Enter '1': it is accepted (minimum allowed value)", async () => {
      await flows.typeStreams('1');
      expect(await flows.streamsValue()).toBe('1');
      expect(await flows.fieldInvalid(field())).toBe(false);
    });
  },
);
