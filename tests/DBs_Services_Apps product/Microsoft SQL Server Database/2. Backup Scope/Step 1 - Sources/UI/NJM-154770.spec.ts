import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154770: "[DBM-BK-UI-Source-Left Pane-0019-11] Verify Format (>1 Day Remain)".
// Env (.env, owner-supplied): NAKIVO_BK_LICENSE_EXPIRY_DAYS = whole days (greater than 1, the case uses 5) left on the license applied to the Director right now.
//   Missing value: ABORTED ("Missing in .env"). The test never changes licensing.
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: shares its precondition and env value with NJM-154760; this case asserts the unit ("days", not "hours") and the number.
// UNVERIFIED: the license label markup was never inspected live.
test.use(RUN_OPTIONS);

test('NAKIVO shows the expiration in days when more than one day of the license remains', { tag: '@NJM-154770' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const days = Number(readBackupValue('LICENSE_EXPIRY_DAYS'));
  if (!Number.isInteger(days) || days <= 1) throw new Error(`ABORTED: NAKIVO_BK_LICENSE_EXPIRY_DAYS must be a whole number of days greater than 1 (got "${days}")`);

  await test.step('1. Precondition: a license expiring in more than one day is applied (value from .env)', async () => {
    expect(days).toBeGreaterThan(1);
  });

  await test.step('2. Open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Read the expiration text on the license label: it uses the "days" unit', async () => {
    const label = await flows.readLicenseLabel();
    testInfo.annotations.push({ type: 'observed-outcome', description: `license label: "${label.text}"` });
    const expiry = BkA3SourcesFlows.parseExpiry(label.text);
    expect(expiry, 'no "expires in N days|hours" text in the label').toBeDefined();
    expect(expiry?.unit).toBe('days');
    expect([days, days - 1]).toContain(expiry?.value);
    expect(label.text).not.toMatch(/hours?/i);
  });

  await flows.leaveWizard();
});
