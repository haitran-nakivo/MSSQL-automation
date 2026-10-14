import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154758: "[DBM-BK-UI-Source-Left Pane-0019] Verify License Label Existence".
// Env (.env, owner-supplied): none beyond the Director login. Works with whatever license the Director has; the content is recorded, not compared.
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: UNVERIFIED: the license details label was never seen live (no note mentions it). It is looked up as the smallest visible text that contains "license";
//   if the 11.2.1 UI has no such label the test fails on step 3, which is then a product / spec finding for the owner.
test.use(RUN_OPTIONS);

test('NAKIVO shows a license details label at the bottom of the right pane on Step 1', { tag: '@NJM-154758' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Observe the footer of the right pane: a license details label is visible', async () => {
    const label = await flows.readLicenseLabel();
    testInfo.annotations.push({ type: 'observed-outcome', description: `license label: "${label.text}"` });
    expect(label.text, 'no license label found').toMatch(/licen[sc]e/i);
  });

  await test.step('4. Read the label content: it carries license usage details beyond the word "License"', async () => {
    const label = await flows.readLicenseLabel();
    expect(label.text.replace(/licen[sc]e:?/gi, '').trim(), 'the label has no usage details').not.toBe('');
  });

  await flows.leaveWizard();
});
