import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../../../flows/bkA7-options.flows';
import { readA7Setup } from '../../../../../../helpers/bkA7-env';

// NJM-154861: "[MSSQL-BK-UI-DT-0002-1] Verify Streams Checkbox Tooltip".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (wizard opened and cancelled).
// case-vs-ui: Data Transfer is the Options step (Step 4) of the 4-step wizard. The tooltip is read from the Ext tooltip (.x-tip) after hovering the (i) icon, then the label (UNVERIFIED icon locator).
test.use(RUN_OPTIONS);

const EXPECTED = 'Increase the speed of Microsoft SQL Server database backups by increasing the number of streams used by the backup process.';

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7OptionsFlows(page, backupFlows).leaveWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO shows the documented tooltip on the concurrent streams checkbox of the Options step',
  { tag: '@NJM-154861' },
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

    await test.step('3. Hover the streams checkbox / info icon: the tooltip text is shown', async () => {
      const tip = await flows.tooltipOf(flows.ui.checkboxLabel('Limit data backup to'));
      testInfo.annotations.push({ type: 'observed-outcome', description: `Tooltip text read: "${tip}"` });
      expect(tip, 'no tooltip appeared on the streams checkbox').not.toBe('');
      expect(tip).toBe(EXPECTED);
    });
  },
);
