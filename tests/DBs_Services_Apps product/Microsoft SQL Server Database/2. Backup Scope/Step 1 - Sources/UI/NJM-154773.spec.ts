import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154773: "[DBM-BK-UI-Source-Right Pane-0002] Verify Right Pane Empty State".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_DB_SIMPLE (a database used to select and deselect).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: "ensure all items are deselected": the state is reached twice, on opening and after ticking and unticking a database (the empty state returns).
test.use(RUN_OPTIONS);

test('NAKIVO shows "Select at least one item on the left" in the right pane when nothing is selected', { tag: '@NJM-154773' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Ensure all items are deselected: tick and untick a database', async () => {
    await flows.clickCheckbox(db);
    await expect.poll(() => flows.isChecked(db), { timeout: 10_000 }).toBe(true);
    await expect(flows.sources.selectionSummary).toHaveText(/item\(s\) were added to this job/);
    await flows.clickCheckbox(db);
    await expect.poll(() => flows.isChecked(db), { timeout: 10_000 }).toBe(false);
    expect((await flows.readTree()).filter((n) => n.checked)).toHaveLength(0);
  });

  await test.step('4. Observe the right pane: the empty state with the instruction text is shown', async () => {
    await expect(flows.sources.selectionSummary).toHaveText(/Select at least one item on the left/);
    expect(await flows.paneCount(db)).toBe(0);
  });

  await flows.leaveWizard();
});
