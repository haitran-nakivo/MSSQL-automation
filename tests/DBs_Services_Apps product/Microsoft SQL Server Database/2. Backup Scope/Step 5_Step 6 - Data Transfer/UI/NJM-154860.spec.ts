import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-154860: "[MSSQL-BK-UI-DT-0002] Verify Streams Checkbox Existence".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (the wizard is opened and cancelled; no job is created).
// case-vs-ui: the wizard has 4 steps; "Step 5/Step 6 - Data Transfer" is the Options step (Step 4), where the control reads "Limit data backup to N concurrent streams".
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7OptionsFlows(page, backupFlows).leaveWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO shows the "Limit data backup to N concurrent streams" checkbox on the Options step of the database backup wizard',
  { tag: '@NJM-154860' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(300_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Data Transfer controls are on Step 4 Options of the 4-step wizard; label "Limit data backup to N concurrent streams".' });

    await test.step('1. Precondition: open Data Protection > + > Backup for Database: the wizard opens on the Source step', async () => {
      await backupFlows.openWizard();
      await expect(backupFlows.wizard.title).toBeVisible();
    });

    await test.step('2. Advance through the wizard to the Options step (the Data Transfer controls)', async () => {
      await flows.advanceToOptions(setup);
      await expect(backupFlows.wizard.jobNameField).toBeVisible();
    });

    await test.step('3. Locate the streams checkbox: it is visible', async () => {
      await expect(flows.ui.checkboxLabel('Limit data backup to')).toBeVisible();
      await expect(backupFlows.wizard.concurrentStreamsField()).toBeVisible();
    });
  },
);
