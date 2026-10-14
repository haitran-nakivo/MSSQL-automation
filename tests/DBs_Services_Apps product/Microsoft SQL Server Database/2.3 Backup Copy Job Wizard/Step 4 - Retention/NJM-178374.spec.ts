import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178374: "[MSSQL-BKC-RET-01] Verify GFS retention can be configured on the copy target".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_SECONDARY.
// Side effects: opens the wizard and cancels it (afterEach); nothing is saved.
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
  'NAKIVO Backup Copy wizard Retention lets the user enable GFS and set weekly, monthly and yearly counts',
  { tag: '@NJM-178374' },
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

    await test.step('1. Open the wizard and complete the Source step', async () => {
      await flow.openWizard();
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
      await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    });

    await test.step('2. Select the target and configure the schedule (on demand)', async () => {
      await flow.next();
      await backupFlows.chooseDestination(repo);
      await flow.next();
      await flow.setCheckbox(flow.wizard.onDemandCheckbox, true);
    });

    await test.step('3. Click Next: the Retention step', async () => {
      await flow.next();
      const present = await flow.presentSteps();
      if (!present.includes('Retention')) note('case-vs-ui', 'the wizard has no separate Retention step (steps: ' + present.join(', ') + '); retention controls are looked for on the current step');
      await expect(flow.wizard.gfsToggle, 'retention offers GFS').toBeVisible();
    });

    await test.step('4. Enable GFS: the GFS fields become available', async () => {
      await flow.wizard.gfsToggle.click({ timeout: 10_000 });
      expect(await flow.isChecked(flow.wizard.gfsToggle), 'GFS is enabled').toBe(true);
      await expect(flow.wizard.gfsField('weekly'), 'the weekly field is available').toBeEnabled();
    });

    await test.step('5. Set weekly 4, monthly 3, yearly 1', async () => {
      await flow.setGfs({ weekly: 4, monthly: 3, yearly: 1 });
      await expect(flow.wizard.gfsField('weekly')).toHaveValue('4');
      await expect(flow.wizard.gfsField('monthly')).toHaveValue('3');
      await expect(flow.wizard.gfsField('yearly')).toHaveValue('1');
    });
  },
);
