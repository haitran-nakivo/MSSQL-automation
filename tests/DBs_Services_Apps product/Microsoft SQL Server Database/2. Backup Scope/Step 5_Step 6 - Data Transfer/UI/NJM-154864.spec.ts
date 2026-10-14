import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { backupJobName } from '../../../../../../helpers/backup-env';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-154864: "[MSSQL-BK-UI-DT-0002-4] Verify Streams Field Required".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none expected (Finish must be refused); if the product wrongly saves the job, afterEach deletes job NJM-154864.
// case-vs-ui: Data Transfer is the Options step (Step 4) of the 4-step wizard, the last step, so "Next/Finish" is the Finish button.
test.use(RUN_OPTIONS);

let finishPressed = false;

test.afterEach(async ({ page, backupFlows }) => {
  const flows = new BkA7OptionsFlows(page, backupFlows);
  try {
    await flows.leaveWizard();
  } catch {
    // best effort
  }
  if (!finishPressed) return;
  try {
    await backupFlows.discardJobIfPresent(backupJobName('NJM-154864'));
  } catch {
    // best effort
  }
  finishPressed = false;
});

test(
  'NAKIVO requires a value in the concurrent streams field and refuses to finish the job when it is empty',
  { tag: '@NJM-154864' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(300_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const field = () => backupFlows.wizard.concurrentStreamsField();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Data Transfer controls are on Step 4 Options (the last step): Next/Finish is Finish.' });

    await test.step('1. Precondition: open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('2. Advance to the Options step', async () => {
      await flows.advanceToOptions(setup, backupJobName('NJM-154864'));
      await expect(flows.ui.checkboxLabel('Limit data backup to')).toBeVisible();
    });

    await test.step('3. Check the streams checkbox, then clear the streams number field: the field is empty', async () => {
      await flows.setChecked(flows.ui.checkboxLabel('Limit data backup to'), true);
      await flows.clearStreams();
      expect(await flows.streamsValue()).toBe('');
    });

    await test.step('4. Click Finish with the empty field: a validation error is shown and the wizard does not proceed', async () => {
      await backupFlows.wizard.finishButton.click({ timeout: 10_000 });
      finishPressed = true;
      await expect(backupFlows.wizard.title).toBeVisible();
      await expect(backupFlows.wizard.finishButton).toBeVisible();
      expect(await flows.fieldInvalid(field()), 'the empty streams field is not marked invalid').toBe(true);
    });

    await test.step('Ad hoc (negative): the wizard is still open on the Options step (nothing was saved)', async () => {
      await expect(backupFlows.wizard.jobNameField).toBeVisible();
    });
  },
);
