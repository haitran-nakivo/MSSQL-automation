import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154741: "[DBM-BK-UI-Source-Left Pane-0004] Verify Single View Mode".
// Env (.env, owner-supplied): none beyond the Director login (the Inventory must hold at least one SQL item).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: "Jobs > Create" is Data Protection > "+" > Backup for Database.
// case-vs-ui: the UI shows no view switch at all (not even an "Inventory View" caption was recorded): the check is that no List / Tree / other view toggle text exists; the texts that mention "view" are attached as observed-outcome.
test.use(RUN_OPTIONS);

test('NAKIVO offers only the Inventory view in the Step 1 source pane', { tag: '@NJM-154741' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);

  await test.step('1. Precondition and 2. open the wizard: Step 1 shows the Inventory tree', async () => {
    await flows.openStep1();
    expect(await flows.visibleRowCount(), 'the Inventory tree is empty').toBeGreaterThan(0);
  });

  await test.step('3. Look for view-mode toggle controls (List vs Tree): none is present', async () => {
    const texts = await flows.viewModeTexts();
    testInfo.annotations.push({ type: 'observed-outcome', description: `texts mentioning "view": ${JSON.stringify(texts)}` });
    expect(texts.filter((t) => /\b(list|tree|folder|host|vm|datastore)s?\b.*\bview\b|\bview\b.*\b(list|tree)\b/i.test(t)), 'a view toggle is shown').toEqual([]);
  });

  await test.step('4. Confirm the available source view: only the Inventory tree exists', async () => {
    const texts = await flows.viewModeTexts();
    expect(texts.filter((t) => !/inventory/i.test(t)), 'a view option other than Inventory exists').toEqual([]);
    expect(await flows.visibleRowCount()).toBeGreaterThan(0);
  });

  await flows.leaveWizard();
});
