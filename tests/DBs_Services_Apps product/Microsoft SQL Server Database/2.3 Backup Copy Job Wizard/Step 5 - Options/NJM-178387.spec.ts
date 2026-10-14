import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178387: "[MSSQL-BKC-OPT-07] Verify bottleneck detection checkbox".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_SECONDARY.
// Side effects: opens the wizard up to the Options step and cancels it (afterEach); nothing is saved.
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: the cases say "Jobs > Create > Backup copy job for Microsoft SQL Server": the UI entry is Data Protection > + > Backup Copy Job (a Microsoft SQL Server choice may follow; UNVERIFIED).
// case-vs-ui: the cases describe five steps (Source, Destination, Schedule, Retention, Options); the wizard is only checked for the steps it really shows (CopyFlows.presentSteps) and a missing step is recorded as case-vs-ui.
test.use(RUN_OPTIONS);

let copy: CopyFlows | undefined;
test.afterEach(async () => {
  try {
    await copy?.cleanup();
  } catch {
    /* best effort */
  }
  copy = undefined;
});

test(
  'NAKIVO Backup Copy wizard Options step has a bottleneck detection checkbox that toggles on and off',
  { tag: '@NJM-178387' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(600000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupDatabase('INSTANCE', 'FULL');
    const repo = readBackupRepo('SECONDARY');

    await test.step('1. Complete Steps 1 to 4 and open the Options step', async () => {
      const request = { name: 'NJM-TMP', item: source.item, databases: [db], destination: repo };
      await flow.openWizard();
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
      const reached = await flow.advanceTo('Options', request);
      expect(reached, 'the wizard reaches the Options step').toBe(true);
    });

    await test.step('2. A bottleneck detection checkbox is shown', async () => {
      await expect(flow.wizard.bottleneckCheckbox, 'the bottleneck detection checkbox is shown').toBeVisible();
    });

    await test.step('3. Toggle it on', async () => {
      await flow.setCheckbox(flow.wizard.bottleneckCheckbox, true);
      expect(await flow.isChecked(flow.wizard.bottleneckCheckbox), 'the checkbox is checked').toBe(true);
    });

    await test.step('4. Toggle it off', async () => {
      await flow.setCheckbox(flow.wizard.bottleneckCheckbox, false);
      expect(await flow.isChecked(flow.wizard.bottleneckCheckbox), 'the checkbox is cleared').toBe(false);
      note('observed-outcome', 'persistence of the setting with the saved job was not checked (the wizard is cancelled)');
    });
  },
);
