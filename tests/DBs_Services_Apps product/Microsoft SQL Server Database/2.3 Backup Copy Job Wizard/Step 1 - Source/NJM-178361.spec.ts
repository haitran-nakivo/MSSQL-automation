import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178361: "[MSSQL-BKC-SRC-04] Verify job cannot be saved or run with no source selected".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL.
// Side effects: opens the wizard and cancels it (afterEach); nothing is saved.
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: the cases say "Jobs > Create > Backup copy job for Microsoft SQL Server": the UI entry is Data Protection > + > Backup Copy Job (a Microsoft SQL Server choice may follow; UNVERIFIED).
// case-vs-ui: the cases describe five steps (Source, Destination, Schedule, Retention, Options); the wizard is only checked for the steps it really shows (CopyFlows.presentSteps) and a missing step is recorded as case-vs-ui.
// Ad hoc steps (beyond the case text): Cancel closes the wizard and no job is created (checked by the afterEach cleanup and the Jobs list).
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
  'NAKIVO Backup Copy wizard does not leave the Source step and cannot be saved with no source selected',
  { tag: '@NJM-178361' },
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
    const probeName = backupJobName('NJM-178361');

    await test.step('1. Precondition: a SQL backup with recovery points exists', async () => {
      expect(source.item.length, 'the Inventory item name comes from NAKIVO_BK_INSTANCE_ITEM').toBeGreaterThan(0);
      note('observed-outcome', 'precondition: a SQL backup of ' + db + ' with recovery points must already exist; if the Source tree lacks the item the case ends ABORTED in step 3');
    });

    await test.step('2. Open the Backup Copy Job wizard: no source selected', async () => {
      await flow.openWizard();
      await expect(flow.wizard.title, 'the Backup Copy Job wizard opens').toBeVisible();
      await expect(flow.wizard.stepTab('Source').first(), 'the wizard starts on the Source step').toBeVisible();
      await expect(flow.wizard.selectionSummary).toContainText('Select at least one item');
    });

    await test.step('3. Click Next without a source: the wizard does not advance', async () => {
      await flow.next({ blocked: true });
      await expect(flow.wizard.selectionSummary, 'a message still asks for a source').toContainText('Select at least one item');
      await expect(backupFlows.wizard.destinationCombo, 'Destination step is not shown').toBeHidden();
    });

    await test.step('4. Save / Finish is blocked with no source', async () => {
      await expect(backupFlows.wizard.finishButton, 'Finish is not offered on the Source step').toBeHidden();
      await expect(backupFlows.wizard.finishAndRunButton, 'Finish & Run is not offered on the Source step').toBeHidden();
    });

    await test.step('Ad hoc (negative): Cancel discards the wizard and no job is created', async () => {
      await flow.cancelWizard();
      expect(await backupFlows.jobExists(probeName), 'no job named ' + probeName + ' exists after Cancel').toBe(false);
    });
  },
);
