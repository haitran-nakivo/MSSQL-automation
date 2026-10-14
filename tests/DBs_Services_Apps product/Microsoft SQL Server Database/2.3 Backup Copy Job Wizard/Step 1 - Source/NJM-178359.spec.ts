import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178359: "[MSSQL-BKC-SRC-02] Verify multiple databases and containers can be selected as copy source".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_INSTANCE_DB_SIMPLE.
// Side effects: opens the wizard, ticks source checkboxes and cancels it (afterEach); nothing is saved.
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: the cases say "Jobs > Create > Backup copy job for Microsoft SQL Server": the UI entry is Data Protection > + > Backup Copy Job (a Microsoft SQL Server choice may follow; UNVERIFIED).
// case-vs-ui: the cases describe five steps (Source, Destination, Schedule, Retention, Options); the wizard is only checked for the steps it really shows (CopyFlows.presentSteps) and a missing step is recorded as case-vs-ui.
// Ad hoc steps (beyond the case text): the selection counter text is read after each tick; whether ticking the container after a database keeps the database ticked is recorded as observed-outcome.
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
  'NAKIVO Backup Copy wizard Source step allows selecting several databases and a container at once',
  { tag: '@NJM-178359' },
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

    await test.step('1. Precondition: a SQL backup with several databases and containers exists', async () => {
      expect(source.item.length, 'the Inventory item name comes from NAKIVO_BK_INSTANCE_ITEM').toBeGreaterThan(0);
      note('observed-outcome', 'precondition: a SQL backup of ' + db1 + ' with recovery points must already exist; if the Source tree lacks the item the case ends ABORTED in step 3');
    });

    await test.step('2. Open the Backup Copy Job wizard', async () => {
      await flow.openWizard();
      await expect(flow.wizard.title, 'the Backup Copy Job wizard opens').toBeVisible();
      await expect(flow.wizard.stepTab('Source').first(), 'the wizard starts on the Source step').toBeVisible();
    });

    await test.step('3. Expand the host / instance: databases and containers have checkboxes', async () => {
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
      if ((await flow.wizard.treeRow(db1).count()) === 0) await flow.wizard.treeRow(source.item).dblclick({ timeout: 10_000 });
      await expect(flow.wizard.base.treeCheckbox(db1), 'a database has a selection checkbox').toBeVisible();
      await expect(flow.wizard.base.treeCheckbox(source.item), 'the container has a selection checkbox').toBeVisible();
    });

    await test.step('4. Tick one database and one container', async () => {
      await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
      await flow.wizard.base.treeCheckbox(source.item).click({ timeout: 10_000 });
      await expect(flow.wizard.selectionSummary, 'the right panel lists the selected items').toContainText(/item\(s\) were added to this job/);
      note('observed-outcome', 'summary after db + container: ' + (await flow.wizard.selectionSummary.innerText()).replace(/\s+/g, ' '));
    });

    await test.step('5. Tick a second database', async () => {
      await backupFlows.selectSources([{ item: source.item, databases: [db2] }]);
      await expect(flow.wizard.selectionSummary, 'the selection still shows added items').toContainText(/item\(s\) were added to this job/);
      note('observed-outcome', 'summary after the second database: ' + (await flow.wizard.selectionSummary.innerText()).replace(/\s+/g, ' '));
    });
  },
);
