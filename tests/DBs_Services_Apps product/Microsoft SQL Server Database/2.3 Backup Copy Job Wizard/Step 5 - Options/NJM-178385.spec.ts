import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178385: "[MSSQL-BKC-OPT-05] Verify backup encryption dropdown".
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
  'NAKIVO Backup Copy wizard Options step has a backup encryption dropdown with selectable values',
  { tag: '@NJM-178385' },
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
    let chosen = "";

    await test.step('1. Complete Steps 1 to 4 and open the Options step', async () => {
      const request = { name: 'NJM-TMP', item: source.item, databases: [db], destination: repo };
      await flow.openWizard();
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
      const reached = await flow.advanceTo('Options', request);
      expect(reached, 'the wizard reaches the Options step').toBe(true);
    });

    await test.step('2. A backup encryption dropdown is shown', async () => {
      await expect(flow.wizard.fieldByLabel(/Backup encryption|Encryption/), 'the backup encryption control is shown').toBeVisible();
    });

    await test.step('3. Open the dropdown: the options are listed', async () => {
      const items = await flow.optionItems('Backup encryption');
      expect(items.length, 'options are listed').toBeGreaterThan(0);
      note('observed-outcome', 'backup encryption options: ' + items.join(' | '));
      chosen = items[items.length - 1];
    });

    await test.step('4. Select a value', async () => {
      await flow.pickOption('Backup encryption', chosen);
      const passwordShown = await flow.closePasswordDialogIfShown();
      if (passwordShown) {
        note('observed-outcome', 'choosing ' + chosen + ' opened the password dialog; it was cancelled, no password was created');
      } else {
        expect(await flow.optionValue('Backup encryption'), 'the selection is applied').toContain(chosen);
      }
    });
  },
);
