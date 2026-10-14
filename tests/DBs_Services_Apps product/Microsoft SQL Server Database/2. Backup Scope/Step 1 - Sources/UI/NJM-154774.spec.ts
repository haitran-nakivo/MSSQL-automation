import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154774: "[DBM-BK-UI-Source-Right Pane-0003] Verify Right Pane Behavior Standard".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_DB_SIMPLE (a database on an Inventory item).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the standard "Wizards - Selected Items Pane" text is not available; the asserted behaviour is the case's: an entry per selected item, a remove (X) control on hover that removes the entry
//   and unticks the item in the tree.
// UNVERIFIED: the remove (X) control is located as the first element with a remove / close / delete / x-tool class inside the entry's row; never seen live.
test.use(RUN_OPTIONS);

test('NAKIVO removes an item from the right pane with its X control and unchecks it in the source tree', { tag: '@NJM-154774' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Select a database so it appears in the right pane', async () => {
    await flows.clickCheckbox(db);
    await expect.poll(() => flows.paneCount(db), { timeout: 10_000, message: 'the database is not listed in the right pane' }).toBe(1);
  });

  await test.step('4. Hover over the item in the right pane and click its Remove (X) control: the item is removed from the list', async () => {
    await flows.removeFromPane(db);
    await expect.poll(() => flows.paneCount(db), { timeout: 10_000, message: 'the entry is still in the right pane' }).toBe(0);
  });

  await test.step('5. Observe the source tree: the item is unchecked', async () => {
    await expect.poll(() => flows.isChecked(db), { timeout: 10_000, message: 'the tree item is still checked' }).toBe(false);
    await expect(flows.sources.selectionSummary).toHaveText(/Select at least one item on the left/);
  });

  await flows.leaveWizard();
});
