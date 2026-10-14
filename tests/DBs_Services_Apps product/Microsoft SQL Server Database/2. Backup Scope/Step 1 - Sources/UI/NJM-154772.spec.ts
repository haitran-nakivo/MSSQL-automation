import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154772: "[DBM-BK-UI-Source-Right Pane-0001] Verify Right Pane Multi-Item View".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_DB_SIMPLE and NAKIVO_BK_INSTANCE_DB_FULL (two distinct databases on the same item).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the right pane text for several items is the one in the notes ("N item(s) were added to this job. New items created on or moved to the source host will be automatically added to this job.")
//   plus one entry per ticked database and the hint "Drag items to set processing priority"; the count N is asserted for the two databases.
test.use(RUN_OPTIONS);

test('NAKIVO lists every selected database in the right pane when several are selected', { tag: '@NJM-154772' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const db2 = readBackupDatabase('INSTANCE', 'FULL');

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Select two databases in the source tree: both are checked', async () => {
    await flows.clickCheckbox(db1);
    await flows.clickCheckbox(db2);
    await expect.poll(() => flows.isChecked(db1), { timeout: 10_000 }).toBe(true);
    await expect.poll(() => flows.isChecked(db2), { timeout: 10_000 }).toBe(true);
  });

  await test.step('4. Observe the right pane: it lists all selected items in the multi-item view', async () => {
    await expect.poll(() => flows.paneCount(db1), { timeout: 10_000, message: `"${db1}" is not listed in the right pane` }).toBe(1);
    await expect.poll(() => flows.paneCount(db2), { timeout: 10_000, message: `"${db2}" is not listed in the right pane` }).toBe(1);
    await expect(flows.sources.selectionSummary).toHaveText(/2 item\(s\) were added to this job/);
    await expect(flows.sources.dragHint).toBeVisible();
    testInfo.annotations.push({ type: 'observed-outcome', description: `right pane summary: "${await flows.summaryText()}"` });
  });

  await flows.leaveWizard();
});
