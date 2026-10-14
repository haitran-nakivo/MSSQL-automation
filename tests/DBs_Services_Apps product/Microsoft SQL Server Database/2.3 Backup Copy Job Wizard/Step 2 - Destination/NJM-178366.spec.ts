import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178366: "[MSSQL-BKC-DST-01] Verify supported repository targets are selectable".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_SECONDARY.
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
  'NAKIVO Backup Copy wizard Destination step lists a supported repository and accepts it as the target',
  { tag: '@NJM-178366' },
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

    await test.step('1. Precondition: a supported target (stream) repository exists', async () => {
      expect(repo.length).toBeGreaterThan(0);
    });

    await test.step('2. Open the wizard and complete the Source step', async () => {
      await flow.openWizard();
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
      await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    });

    await test.step('3. Click Next: the Destination step with the target selector', async () => {
      await flow.next();
      await expect(backupFlows.wizard.destinationCombo, 'Step 2 Destination shows the target selector').toBeVisible();
    });

    await test.step('4. Open the selector: supported targets are listed', async () => {
      const items = await flow.destinationItems();
      expect(items.some((t) => t.includes(repo)), 'the repository ' + repo + ' is listed').toBe(true);
      note('observed-outcome', 'destination entries: ' + items.join(' | '));
    });

    await test.step('5. Select the repository as the destination', async () => {
      await backupFlows.chooseDestination(repo);
      expect(await flow.destinationValue(), 'the repository is accepted as the target').toContain(repo);
    });
  },
);
