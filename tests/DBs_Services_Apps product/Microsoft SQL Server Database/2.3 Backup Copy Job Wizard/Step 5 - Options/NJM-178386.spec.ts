import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178386: "[MSSQL-BKC-OPT-06] Verify Limit transporter load field (range 1-999, default 3)".
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
  'NAKIVO Backup Copy wizard Options step limits the transporter load to 1-999 with a default of 3',
  { tag: '@NJM-178386' },
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

    await test.step('2. The "Limit transporter load" field is shown with default 3', async () => {
      await expect(flow.wizard.transporterLoadField, 'the Limit transporter load field is shown').toBeVisible();
      expect(await flow.transporterLoadValue(), 'the default is 3').toBe('3');
    });

    await test.step('3. A value inside the range (999) is accepted', async () => {
      await flow.setTransporterLoad(999);
      expect(await flow.transporterLoadValue()).toBe('999');
      expect(await backupFlows.isInvalid(flow.wizard.transporterLoadField), '999 is not flagged invalid').toBe(false);
    });

    await test.step('4. Values outside the range (0 and 1000) are rejected or clamped', async () => {
      for (const value of ['0', '1000']) {
        await flow.setTransporterLoad(value);
        const shown = Number(await flow.transporterLoadValue());
        const invalid = await backupFlows.isInvalid(flow.wizard.transporterLoadField);
        expect(invalid || (shown >= 1 && shown <= 999), value + ' is flagged invalid or clamped into 1-999').toBe(true);
      }
    });
  },
);
