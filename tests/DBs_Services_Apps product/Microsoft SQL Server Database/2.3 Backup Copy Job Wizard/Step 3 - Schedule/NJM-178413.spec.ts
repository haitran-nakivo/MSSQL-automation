import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178413: "[MSSQL-BKC-SCH-03] Verify Immutable for: field is shown in the Create Schedule dialog".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_IMMUTABLE.
// Side effects: opens the wizard and cancels it (afterEach); nothing is saved.
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: the cases say "Jobs > Create > Backup copy job for Microsoft SQL Server": the UI entry is Data Protection > + > Backup Copy Job (a Microsoft SQL Server choice may follow; UNVERIFIED).
// case-vs-ui: the cases describe five steps (Source, Destination, Schedule, Retention, Options); the wizard is only checked for the steps it really shows (CopyFlows.presentSteps) and a missing step is recorded as case-vs-ui.
// case-vs-ui: the case says Create Schedule dialog: the schedule is inline in the wizard (UNVERIFIED for the copy wizard), so the field is looked for on the Schedule step.
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
  'NAKIVO Backup Copy schedule shows the "Immutable for" field when the target has immutability enabled',
  { tag: '@NJM-178413' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(600000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupDatabase('INSTANCE', 'FULL');
    const repo = readBackupRepo('IMMUTABLE');

    await test.step('1. Open the wizard and complete the Source step', async () => {
      await flow.openWizard();
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
      await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    });

    await test.step('2. Select an immutability-capable target with immutability enabled and open the Schedule step', async () => {
      await flow.next();
      await backupFlows.chooseDestination(repo);
      await flow.enableImmutability(7);
      await flow.next();
      await expect(flow.wizard.onDemandCheckbox, 'the Schedule step is shown').toBeVisible();
    });

    await test.step('3. Create a new schedule', async () => {
      await flow.setCheckbox(flow.wizard.onDemandCheckbox, false);
      await expect(backupFlows.wizard.scheduleField('type')).toBeVisible();
    });

    await test.step('4. The "Immutable for:" field is shown', async () => {
      await expect(flow.wizard.textLike(/Immutable for/i), 'the Immutable for field is shown with the schedule').toBeVisible();
    });
  },
);
