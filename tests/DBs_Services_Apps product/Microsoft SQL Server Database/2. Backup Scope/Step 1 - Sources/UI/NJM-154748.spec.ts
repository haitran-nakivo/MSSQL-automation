import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154748: "[DBM-BK-UI-Source-Left Pane-0010] Verify Scroll Bar Appearance".
// Env (.env, owner-supplied): none beyond the Director login. The lab must list enough SQL items and databases to overflow the pane; when the window is big
//   the test first tries to shrink the viewport to 400 px high; if the tree still fits, the test ends ABORTED (not enough items).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: "Expand instances so items exceed the pane": the observed tree is already fully expanded by default, so no expansion is needed.
// UNVERIFIED: the scrolling container is found as the first ancestor of a tree row with overflow-y auto / scroll; a native scrollbar thumb is not inspected.
test.use(RUN_OPTIONS);

test('NAKIVO shows a vertical scroll bar on the Step 1 source tree when it does not fit and scrolls to every item', { tag: '@NJM-154748' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Make the tree taller than the pane: a vertical scroll bar appears', async () => {
    let info = await flows.treeScrollInfo();
    if (!info.scrollable) {
      const resized = await flows.tryShrinkViewport(400);
      testInfo.annotations.push({ type: 'observed-outcome', description: `viewport shrink attempted: ${resized}` });
      if (resized) await expect.poll(async () => (await flows.treeScrollInfo()).scrollHeight, { timeout: 5_000 }).toBeGreaterThan(0);
      info = await flows.treeScrollInfo();
    }
    if (!info.scrollable) throw new Error(`ABORTED: the source tree fits its pane (scrollHeight ${info.scrollHeight}, clientHeight ${info.clientHeight}); the lab lists too few items to overflow it`);
    expect(info.scrollHeight).toBeGreaterThan(info.clientHeight);
  });

  await test.step('4. Scroll the pane: the tree scrolls and the last item becomes reachable', async () => {
    const moved = await flows.scrollTreeToEnd();
    expect(moved, 'the tree did not scroll').toBeGreaterThan(0);
    await expect(flows.sources.treeRows().last()).toBeInViewport();
  });

  await flows.leaveWizard();
});
