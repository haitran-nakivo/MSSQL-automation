import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154759: "[DBM-BK-UI-Source-Left Pane-0019-1] Verify License Label Icon".
// Env (.env, owner-supplied): none beyond the Director login.
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the case names the design asset "ST006"; the DOM does not carry design asset ids, so the test asserts that an icon element renders next to the license text
//   (image, background image or icon class) and attaches its signature as observed-outcome for the owner to compare with ST006.
// UNVERIFIED: the license label markup was never inspected live.
test.use(RUN_OPTIONS);

test('NAKIVO renders an icon before the license details label on Step 1', { tag: '@NJM-154759' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Inspect the license details label: an icon is displayed on it', async () => {
    const label = await flows.readLicenseLabel();
    testInfo.annotations.push({ type: 'observed-outcome', description: `label "${label.text}", icon: ${label.iconSignature || '(none)'}` });
    expect(label.text, 'no license label found').toMatch(/licen[sc]e/i);
    expect(label.iconSignature, 'no icon element found next to the license label').not.toBe('');
  });

  await test.step('4. Confirm the icon rendering: the icon has a real image (not an empty element)', async () => {
    const label = await flows.readLicenseLabel();
    expect(label.iconSignature).toMatch(/src=|bg=|class=\S*icon/i);
  });

  await flows.leaveWizard();
});
