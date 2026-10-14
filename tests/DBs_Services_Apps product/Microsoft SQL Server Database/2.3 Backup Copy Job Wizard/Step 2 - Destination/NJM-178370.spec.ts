import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178370: "[MSSQL-BKC-DST-05] Verify immutability can be enabled on the target for database backup copy".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_IMMUTABLE.
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
  'NAKIVO Backup Copy wizard offers immutability for an immutability-capable target and accepts a period',
  { tag: '@NJM-178370' },
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

    await test.step('1. Precondition: an immutability-capable stream repository exists', async () => {
      expect(repo.length).toBeGreaterThan(0);
    });

    await test.step('2. Open the wizard and complete the Source step', async () => {
      await flow.openWizard();
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
      await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    });

    await test.step('3. On Destination select the immutability-capable repository: the immutability option appears', async () => {
      await flow.next();
      await backupFlows.chooseDestination(repo);
      await expect(flow.wizard.immutableToggle, 'the immutability option is offered').toBeVisible();
    });

    await test.step('4. Enable immutability and set the period (7 days)', async () => {
      await flow.enableImmutability(7);
      expect(await flow.isChecked(flow.wizard.immutableToggle), 'immutability is enabled').toBe(true);
      expect(await flow.wizard.immutableForField.inputValue(), 'the period is 7 days').toBe('7');
    });
  },
);
