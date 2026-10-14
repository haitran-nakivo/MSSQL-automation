import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource, readBackupValue } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178367: "[MSSQL-BKC-DST-02] Verify Tape is selectable as a target for database backup copy".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_TAPE_TARGET (name of the configured tape target as the selector shows it).
// Side effects: opens the wizard and cancels it (afterEach); nothing is saved. No tape hardware is touched.
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
  'NAKIVO Backup Copy wizard Destination step lists a tape target and accepts it',
  { tag: '@NJM-178367' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(600000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupDatabase('INSTANCE', 'FULL');
    const tape = readBackupValue('TAPE_TARGET');

    await test.step('1. Precondition: a tape target is configured', async () => {
      expect(tape.length).toBeGreaterThan(0);
    });

    await test.step('2. Open the wizard and complete the Source step', async () => {
      await flow.openWizard();
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
      await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    });

    await test.step('3. Click Next: the Destination step', async () => {
      await flow.next();
      await expect(backupFlows.wizard.destinationCombo).toBeVisible();
    });

    await test.step('4. Open the selector: the tape target is listed', async () => {
      const items = await flow.destinationItems();
      expect(items.some((t) => t.includes(tape)), 'the tape target ' + tape + ' is listed').toBe(true);
      note('observed-outcome', 'destination entries: ' + items.join(' | '));
    });

    await test.step('5. Select the tape target', async () => {
      await backupFlows.chooseDestination(tape);
      expect(await flow.destinationValue(), 'the tape target is accepted').toContain(tape);
    });
  },
);
