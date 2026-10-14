import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178371: "[MSSQL-BKC-SCH-01] Verify a schedule can be created for the backup copy job".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_SECONDARY.
// Side effects: opens the wizard and cancels it (afterEach); nothing is saved.
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: the cases say "Jobs > Create > Backup copy job for Microsoft SQL Server": the UI entry is Data Protection > + > Backup Copy Job (a Microsoft SQL Server choice may follow; UNVERIFIED).
// case-vs-ui: the cases describe five steps (Source, Destination, Schedule, Retention, Options); the wizard is only checked for the steps it really shows (CopyFlows.presentSteps) and a missing step is recorded as case-vs-ui.
// case-vs-ui: the case says a Create Schedule dialog opens and the schedule is "Daily at HH:MM, Mon-Fri": the Backup-for-Database wizard has the schedule inline (Weekly / Monthly / Yearly / Periodic); the copy wizard is assumed to match, so the inline fields are used (UNVERIFIED).
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
  'NAKIVO Backup Copy wizard Schedule step lets the user configure a schedule',
  { tag: '@NJM-178371' },
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

    await test.step('2. Select the target on Step 2 and click Next: the Schedule step', async () => {
      await flow.next();
      await backupFlows.chooseDestination(repo);
      await flow.next();
      await expect(flow.wizard.onDemandCheckbox, 'the Schedule step shows the on-demand option').toBeVisible();
    });

    await test.step('3. Enable scheduling: the schedule fields are shown', async () => {
      await flow.setCheckbox(flow.wizard.onDemandCheckbox, false);
      await expect(backupFlows.wizard.scheduleField('type'), 'the schedule type field is shown').toBeVisible();
    });

    await test.step('4. Configure the schedule (Weekly) and confirm', async () => {
      await backupFlows.fillSchedule({ name: 'NJM-178371-schedule', type: 'Weekly' });
      await expect(backupFlows.wizard.scheduleField('type')).toHaveValue('Weekly');
      await expect(backupFlows.wizard.scheduleField('scheduleName')).toHaveValue('NJM-178371-schedule');
    });
  },
);
