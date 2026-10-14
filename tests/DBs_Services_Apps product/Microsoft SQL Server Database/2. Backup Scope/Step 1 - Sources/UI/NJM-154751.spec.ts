import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154751: "[DBM-BK-UI-Source-Left Pane-0012] Verify Multi-Select Capability".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_DB_SIMPLE (a database) and NAKIVO_BK_AG_ITEM (an Availability Group item = the second, container-type selection).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the case's <second-item> is the AG item, so a database and a container are selected together (mixed types). The AG item is not the database's parent, so the two ticks are independent.
// case-vs-ui: whether the right pane lists a ticked container by name is not documented (it says "N item(s) were added to this job"); the pane entry of the AG item is attached as observed-outcome.
test.use(RUN_OPTIONS);

test('NAKIVO keeps a database and a container selected together in the Step 1 tree and lists them in the right pane', { tag: '@NJM-154751' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  const second = readBackupValue('AG_ITEM');

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
    expect(await flows.isChecked(db)).toBe(false);
    expect(await flows.isChecked(second)).toBe(false);
  });

  await test.step('3. Tick the checkbox of one SQL database: it is checked', async () => {
    await flows.clickCheckbox(db);
    await expect.poll(() => flows.isChecked(db), { timeout: 10_000 }).toBe(true);
  });

  await test.step('4. Tick a second item (an Availability Group): it is checked', async () => {
    await flows.clickCheckbox(second);
    await expect.poll(() => flows.isChecked(second), { timeout: 10_000 }).toBe(true);
  });

  await test.step('5. Observe all selected items: both stay checked and the right pane lists the selection', async () => {
    expect(await flows.isChecked(db)).toBe(true);
    expect(await flows.isChecked(second)).toBe(true);
    await expect.poll(() => flows.paneCount(db), { timeout: 10_000, message: 'the database is not listed in the right pane' }).toBe(1);
    await expect(flows.sources.selectionSummary).toHaveText(/item\(s\) were added to this job/);
    testInfo.annotations.push({ type: 'observed-outcome', description: `summary: "${await flows.summaryText()}"; entries named "${second}" in the pane: ${await flows.paneCount(second)}` });
  });

  await flows.leaveWizard();
});
