import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154742: "[DBM-BK-UI-Source-Left Pane-0005] Verify Live Search Existence".
// Env (.env, owner-supplied): none beyond the Director login (the Inventory must hold at least one SQL item).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: "Jobs > Create" is Data Protection > "+" > Backup for Database.
test.use(RUN_OPTIONS);

test('NAKIVO shows an editable live search field above the Step 1 source tree', { tag: '@NJM-154742' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);

  await test.step('1. Precondition and 2. open the wizard: Step 1 shows the Inventory tree', async () => {
    await flows.openStep1();
    expect(await flows.visibleRowCount(), 'the Inventory tree is empty').toBeGreaterThan(0);
  });

  await test.step('3. Observe the top of the left pane: a search field is visible above the tree', async () => {
    await expect(flows.sources.searchField).toBeVisible();
    const field = await flows.sources.searchField.boundingBox();
    const firstRow = await flows.sources.treeRows().first().boundingBox();
    expect(field && firstRow && field.y < firstRow.y, 'the search field is not above the tree').toBe(true);
  });

  await test.step('4. Inspect the search field: it is editable and accepts text', async () => {
    expect(await flows.searchEditable()).toBe(true);
    await flows.typeSearch('a');
    await expect.poll(() => flows.searchValue(), { timeout: 5_000 }).toBe('a');
  });

  await flows.leaveWizard();
});
