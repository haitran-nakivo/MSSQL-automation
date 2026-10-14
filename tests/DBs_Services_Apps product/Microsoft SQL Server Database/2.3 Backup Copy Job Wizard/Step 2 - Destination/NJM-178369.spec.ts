import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource, readBackupValue } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178369: "[MSSQL-BKC-DST-04] Verify Advanced setup allows a different destination per database".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_SECONDARY, NAKIVO_BK_COPY_TARGET_REPO_2 (a second supported target repository).
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
  'NAKIVO Backup Copy wizard Advanced setup lets each database have its own destination repository',
  { tag: '@NJM-178369' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(600000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db1 = readBackupDatabase('INSTANCE', 'FULL');
    const db2 = readBackupDatabase('INSTANCE', 'SIMPLE');
    const repo1 = readBackupRepo('SECONDARY');
    const repo2 = readBackupValue('COPY_TARGET_REPO_2');

    await test.step('1. Precondition: two supported target repositories exist', async () => {
      if (repo1 === repo2) throw new Error('ABORTED: NAKIVO_BK_COPY_TARGET_REPO_2 must name a different repository than NAKIVO_BK_REPO_SECONDARY');
    });

    await test.step('2. Open the wizard and select two databases', async () => {
      await flow.openWizard();
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
      await backupFlows.selectSources([{ item: source.item, databases: [db1, db2] }]);
    });

    await test.step('3. Next, then switch to Advanced setup: per-database destinations are shown', async () => {
      await flow.next();
      await backupFlows.openAdvancedSetup();
      await expect(flow.wizard.textLike(db1), 'the first database has its own row').toBeVisible();
      await expect(flow.wizard.textLike(db2), 'the second database has its own row').toBeVisible();
    });

    await test.step('4. Assign the first database to the first repository', async () => {
      await flow.setAdvancedDestination(db1, repo1);
      await expect(flow.wizard.textLike(repo1), 'the first repository is shown for the first database').toBeVisible();
    });

    await test.step('5. Assign the second database to a different repository', async () => {
      await flow.setAdvancedDestination(db2, repo2);
      await expect(flow.wizard.textLike(repo2), 'the second repository is shown for the second database').toBeVisible();
    });
  },
);
