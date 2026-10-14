import { test, expect } from '../../../../fixtures';
import { RUN_OPTIONS } from '../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../flows/bkA7-options.flows';
import { backupJobName } from '../../../../helpers/backup-env';
import { readA7Setup } from '../../../../helpers/bkA7-env';

// NJM-191223: "ENC-01 - Backup encryption default state in Step 4. Options".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: creates job NJM-191223 on demand and never runs it (the "existing job that never had encryption enabled"); deleted in afterEach.
// case-vs-ui: the case's data is "an existing backup job"; the spec creates its own so no lab job is touched. The (i) icon locator is UNVERIFIED (tooltip read from .x-tip after hover).
//   "Directly below Network encryption" is checked by the vertical gap between the rows being the same as between Network acceleration and Network encryption.
test.use(RUN_OPTIONS);

const TOOLTIP = 'If enabled, all created recovery points will be encrypted.';
let jobCreated = false;

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7OptionsFlows(page, backupFlows).leaveWizard();
  } catch {
    // best effort
  }
  if (!jobCreated) return;
  try {
    await backupFlows.discardJobIfPresent(backupJobName('NJM-191223'));
  } catch {
    // best effort
  }
  jobCreated = false;
});

test(
  'NAKIVO shows Backup encryption Disabled, with Enabled/Disabled choices, a tooltip and no settings link, on a job that never had encryption',
  { tag: '@NJM-191223' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(600_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const name = backupJobName('NJM-191223');

    await test.step('1. Precondition: a job that never had encryption enabled exists (created on demand, not run)', async () => {
      await flows.createJob(setup, name);
      jobCreated = true;
      await expect(backupFlows.jobs.statusLine).toBeVisible();
    });

    await test.step('2. Data Protection > select the job > Manage > Edit, open the 4. Options step', async () => {
      await flows.openEditOptions(name);
      await expect(flows.ui.optionLabel('Backup encryption')).toBeVisible();
    });

    await test.step('3. Backup encryption is below Network encryption, its value is Disabled, the dropdown offers exactly Disabled and Enabled, no settings link', async () => {
      const accelTop = await flows.labelTop(flows.ui.optionLabel('Network acceleration'));
      const netTop = await flows.labelTop(flows.ui.optionLabel('Network encryption'));
      const encTop = await flows.labelTop(flows.ui.optionLabel('Backup encryption'));
      expect(encTop, 'Backup encryption is not below Network encryption').toBeGreaterThan(netTop);
      expect(Math.abs(encTop - netTop - (netTop - accelTop)), 'a row sits between Network encryption and Backup encryption').toBeLessThanOrEqual(8);
      expect(await flows.comboValue('Backup encryption')).toBe('Disabled');
      expect(await flows.comboChoices('Backup encryption')).toEqual(['Disabled', 'Enabled']);
      expect(await flows.ui.encryptionSettingsLink().count(), 'a settings link is shown while encryption is Disabled').toBe(0);
    });

    await test.step('4. Hover the (i) icon next to Backup encryption: the tooltip reads the documented text', async () => {
      const tip = await flows.tooltipOf(flows.ui.optionLabel('Backup encryption'));
      testInfo.annotations.push({ type: 'observed-outcome', description: `Tooltip text read: "${tip}"` });
      expect(tip).toBe(TOOLTIP);
    });

    await test.step('5. Network acceleration is enabled and selectable', async () => {
      expect(await flows.isDisabled(backupFlows.wizard.optionInput('Network acceleration'))).toBe(false);
    });

    await test.step('6. Cancel the wizard and reopen the job: Backup encryption is still Disabled', async () => {
      await flows.leaveWizard();
      await flows.openEditOptions(name);
      expect(await flows.comboValue('Backup encryption')).toBe('Disabled');
      await flows.leaveWizard();
    });
  },
);
