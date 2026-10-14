import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154763: "[DBM-BK-UI-Source-Left Pane-0019-5] Verify Irrelevant Limits Hidden".
// Env (.env, owner-supplied): none beyond the Director login. Works with the Director's current license (whatever it contains).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: UNVERIFIED: the license label markup was never inspected live; the check is on the text of the label only. The list of non-database counters is the one in the case
//   (EC2, VMware) plus the other workload names of the product (Hyper-V, Nutanix, Proxmox, Microsoft 365, physical machines, sockets).
test.use(RUN_OPTIONS);

const NON_DATABASE = /EC2|VMware|Hyper-V|Nutanix|AHV|Proxmox|Microsoft 365|Office 365|physical|\bVMs?\b|socket|workload/i;

test('NAKIVO shows only database-related license counts in the Step 1 license label', { tag: '@NJM-154763' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Inspect the license label for non-database counters (EC2 instances, VMware, ...): none is shown', async () => {
    const label = await flows.readLicenseLabel();
    testInfo.annotations.push({ type: 'observed-outcome', description: `license label: "${label.text}"` });
    expect(label.text, 'no license label found').toMatch(/licen[sc]e/i);
    expect(label.text).not.toMatch(NON_DATABASE);
  });

  await test.step('4. Confirm the displayed counts: only database-related counts are shown', async () => {
    const label = await flows.readLicenseLabel();
    const counts = label.text.match(/\d+\s+[A-Za-z][\w-]*/g) ?? [];
    expect(counts.filter((c) => !/database|day|hour/i.test(c)), 'counts that are not about databases or time').toEqual([]);
  });

  await flows.leaveWizard();
});
