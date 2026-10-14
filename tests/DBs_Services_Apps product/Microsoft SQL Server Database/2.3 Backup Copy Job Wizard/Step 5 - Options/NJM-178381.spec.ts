import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178381: "[MSSQL-BKC-OPT-01] Verify Options step shows a Job name field with a default name".
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
  'NAKIVO Backup Copy wizard Options step shows a pre-filled Job name that cannot be empty',
  { tag: '@NJM-178381' },
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

    await test.step('2. Inspect the Job name field: pre-filled with a default name', async () => {
      await expect(flow.wizard.jobNameField, 'the Job name field is shown').toBeVisible();
      expect((await flow.jobNameValue()).trim().length, 'the field has a default name').toBeGreaterThan(0);
      note('observed-outcome', 'default job name: ' + (await flow.jobNameValue()));
    });

    await test.step('3. Clear the Job name field: an empty name is not accepted', async () => {
      await flow.clearField(flow.wizard.jobNameField);
      expect(await backupFlows.isInvalid(flow.wizard.jobNameField), 'the empty Job name is flagged invalid').toBe(true);
    });
  },
);
