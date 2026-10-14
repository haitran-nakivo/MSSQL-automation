import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource, readBackupValue } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178368: "[MSSQL-BKC-DST-03] Verify unsupported repositories are disabled with tooltip".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_COPY_UNSUPPORTED_REPO (name of an existing repository that cannot be a database copy target).
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
  'NAKIVO Backup Copy wizard Destination step shows an unsupported repository disabled with an explanatory tooltip',
  { tag: '@NJM-178368' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(600000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupDatabase('INSTANCE', 'FULL');
    const unsupported = readBackupValue('COPY_UNSUPPORTED_REPO');

    await test.step('1. Precondition: an unsupported repository exists next to supported ones', async () => {
      expect(unsupported.length).toBeGreaterThan(0);
    });

    await test.step('2. Open the wizard and complete the Source step', async () => {
      await flow.openWizard();
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
      await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    });

    await test.step('3. Click Next and open the target selector: the repository list is shown', async () => {
      await flow.next();
      await backupFlows.wizard.destinationCombo.click({ timeout: 10_000 });
      await expect(flow.wizard.destinationEntry(unsupported), 'the repository list shows the unsupported repository').toBeVisible();
    });

    await test.step('4. The unsupported repository is disabled and cannot be selected', async () => {
      expect(await flow.isDestinationEntryDisabled(unsupported), 'the unsupported repository is greyed out').toBe(true);
    });

    await test.step('5. Hover the disabled entry: a tooltip explains why', async () => {
      const hover = await flow.destinationEntryHoverTexts(unsupported);
      expect(hover.length, 'a tooltip text appears').toBeGreaterThan(0);
      note('observed-outcome', 'tooltip texts: ' + hover.join(' | '));
    });
  },
);
