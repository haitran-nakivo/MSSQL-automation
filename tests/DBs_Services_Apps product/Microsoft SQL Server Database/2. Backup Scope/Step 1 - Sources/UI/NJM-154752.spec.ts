import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154752: "[DBM-BK-UI-Source-Left Pane-0013] Verify Default Empty Selection".
// Env (.env, owner-supplied): none beyond the Director login (the Inventory must hold at least one SQL item).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: "the right pane is empty": it shows the empty-state text "Select at least one item on the left" and lists no item.
test.use(RUN_OPTIONS);

test('NAKIVO opens Step 1 with every source checkbox unchecked and an empty right pane', { tag: '@NJM-154752' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Inspect all checkboxes of the source tree: all are unchecked', async () => {
    const tree = await flows.readTree();
    expect(tree.length).toBeGreaterThan(0);
    expect(tree.filter((n) => n.checked).map((n) => n.name)).toEqual([]);
  });

  await test.step('4. Observe the right pane: no item is listed and the empty-state text is shown', async () => {
    await expect(flows.sources.selectionSummary).toHaveText(/Select at least one item on the left/);
    await expect(flows.sources.dragHint).toBeHidden();
  });

  await flows.leaveWizard();
});
