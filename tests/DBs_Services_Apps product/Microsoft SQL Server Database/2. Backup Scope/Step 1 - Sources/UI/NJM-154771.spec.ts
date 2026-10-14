import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154771: "[DBM-BK-UI-Source-Left Pane-0019-12] Verify Format (<=1 Day Remain)".
// Env (.env, owner-supplied): NAKIVO_BK_LICENSE_EXPIRY_HOURS = whole hours (1 to 24, the case uses 20) left on the license applied to the Director right now. The owner must apply such a
//   license shortly before the run (it decays by one hour per hour). Missing value: ABORTED ("Missing in .env"). The test never changes licensing.
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the hour number is matched as the env value or one less.
// UNVERIFIED: the license label markup was never inspected live.
test.use(RUN_OPTIONS);

test('NAKIVO shows the expiration in hours when one day or less of the license remains', { tag: '@NJM-154771' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const hours = Number(readBackupValue('LICENSE_EXPIRY_HOURS'));
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) throw new Error(`ABORTED: NAKIVO_BK_LICENSE_EXPIRY_HOURS must be a whole number from 1 to 24 (got "${hours}")`);

  await test.step('1. Precondition: a license expiring in one day or less is applied (value from .env)', async () => {
    expect(hours).toBeLessThanOrEqual(24);
  });

  await test.step('2. Open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Read the expiration text on the license label: it uses the "hours" unit', async () => {
    const label = await flows.readLicenseLabel();
    testInfo.annotations.push({ type: 'observed-outcome', description: `license label: "${label.text}"` });
    const expiry = BkA3SourcesFlows.parseExpiry(label.text);
    expect(expiry, 'no "expires in N days|hours" text in the label').toBeDefined();
    expect(expiry?.unit).toBe('hours');
    expect([hours, hours - 1]).toContain(expiry?.value);
  });

  await flows.leaveWizard();
});
