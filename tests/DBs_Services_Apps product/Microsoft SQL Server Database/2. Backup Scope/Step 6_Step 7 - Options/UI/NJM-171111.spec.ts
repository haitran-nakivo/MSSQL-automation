import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-171111: "[DBM-BK-UI-Options-0001] Options Step - UI".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (wizard opened and cancelled).
// case-vs-ui: the Options step is Step 4 of the 4-step wizard. The "approved mockup" is not available to the automation: step 3 attaches a screenshot of the step for the owner to compare
//   and asserts the controls the notes list. The case's "app-aware" control does not exist on the database Options step (Observed controls: Job name, Job priority, Network acceleration,
//   Network encryption, Backup encryption, Send job run reports to, local pre/post job script, Limit data backup to N concurrent streams, Bottleneck detection). Status PARTIAL.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7OptionsFlows(page, backupFlows).leaveWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO renders all controls of the Options step of the database backup wizard with their defaults',
  { tag: '@NJM-171111' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(300_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Options is Step 4 of 4; no mockup available (screenshot attached); no app-aware control on the database Options step.' });

    await test.step('1. Precondition: open the Backup for Database wizard', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('2. Advance to the Options step', async () => {
      await flows.advanceToOptions(setup);
      await expect(backupFlows.wizard.jobNameField).toBeVisible();
    });

    await test.step('3. Compare the Options step with the approved mockup: a screenshot is attached for the owner', async () => {
      await testInfo.attach('options-step', { body: await page.screenshot(), contentType: 'image/png' });
      await expect(backupFlows.wizard.jobNameField).toBeVisible();
    });

    await test.step('4. Inspect the Options controls: each is rendered with its documented default', async () => {
      for (const label of ['Job priority', 'Network acceleration', 'Network encryption', 'Backup encryption']) {
        await expect(flows.ui.optionLabel(label), `${label} row is not rendered`).toBeVisible();
      }
      expect(await flows.comboValue('Job priority')).toBe('5');
      expect(await flows.comboValue('Network acceleration')).toBe('Disabled');
      expect(await flows.comboValue('Network encryption')).toBe('Disabled');
      expect(await flows.comboValue('Backup encryption')).toBe('Disabled');
      for (const label of ['Send job run reports to', 'Run local pre job script', 'Run local post job script', 'Limit data backup to', 'Bottleneck detection']) {
        await expect(flows.ui.checkboxLabel(label), `${label} checkbox is not rendered`).toBeVisible();
      }
      await expect(backupFlows.wizard.finishButton).toBeVisible();
      await expect(backupFlows.wizard.finishAndRunButton).toBeVisible();
      await expect(backupFlows.wizard.cancelButton).toBeVisible();
    });

    await test.step('Ad hoc: the Job name defaults to "Backup job for Database"', async () => {
      expect(await backupFlows.fieldValue(backupFlows.wizard.jobNameField)).toBe('Backup job for Database');
    });
  },
);
