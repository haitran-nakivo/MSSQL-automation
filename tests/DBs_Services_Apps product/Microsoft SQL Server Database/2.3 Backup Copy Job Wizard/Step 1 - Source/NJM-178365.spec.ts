import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178365: "[MSSQL-BKC-SRC-08] Verify live search filters the inventory tree".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_INSTANCE_DB_SIMPLE.
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
  'NAKIVO Backup Copy wizard Source search filters the tree live and restores it when cleared',
  { tag: '@NJM-178365' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(600000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupDatabase('INSTANCE', 'FULL');
    const other = readBackupDatabase('INSTANCE', 'SIMPLE');
    const fragment = db.slice(0, Math.max(4, Math.min(db.length, 8)));

    await test.step('1. Precondition: a SQL backup with several databases exists', async () => {
      expect(source.item.length, 'the Inventory item name comes from NAKIVO_BK_INSTANCE_ITEM').toBeGreaterThan(0);
      note('observed-outcome', 'precondition: a SQL backup of ' + db + ' with recovery points must already exist; if the Source tree lacks the item the case ends ABORTED in step 3');
    });

    await test.step('2. Open the Backup Copy Job wizard', async () => {
      await flow.openWizard();
      await expect(flow.wizard.title, 'the Backup Copy Job wizard opens').toBeVisible();
      await expect(flow.wizard.stepTab('Source').first(), 'the wizard starts on the Source step').toBeVisible();
    });

    await test.step('3. Type a database name fragment into the search field: the tree is filtered', async () => {
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
      if ((await flow.wizard.treeRow(db).count()) === 0) await flow.wizard.treeRow(source.item).dblclick({ timeout: 10_000 });
      if (other.includes(fragment)) throw new Error('ABORTED: the fragment ' + fragment + ' also matches ' + other + '; the filter check needs a non-matching database name');
      await flow.typeInto(flow.wizard.sourceSearch, fragment);
      await expect(flow.wizard.treeRow(db), 'the matching database stays').toBeVisible();
      await expect(flow.wizard.treeRow(other), 'a non-matching database is filtered out').toHaveCount(0);
    });

    await test.step('4. Clear the search field: the full tree is restored', async () => {
      await flow.clearField(flow.wizard.sourceSearch);
      await expect(flow.wizard.treeRow(other), 'the full tree is back').toBeVisible();
      await expect(flow.wizard.treeRow(db)).toBeVisible();
    });
  },
);
