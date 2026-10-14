import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154760: "[DBM-BK-UI-Source-Left Pane-0019-2] Verify Expiration Display".
// Env (.env, owner-supplied): NAKIVO_BK_LICENSE_EXPIRY_DAYS = the whole number of days (greater than 1) left on the license that is applied to the Director RIGHT NOW
//   (the owner applies a license with an expiry; this test never changes licensing). Missing value: the test ends ABORTED ("Missing in .env").
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the label is read as text; "License expires in X days" is matched as /expires in (\d+) days/ and X must equal the env value or one less (time passes between setting the value and the run).
// UNVERIFIED: the license label markup was never inspected live.
test.use(RUN_OPTIONS);

test('NAKIVO shows "License expires in X days" in the Step 1 license label when the license has an expiration', { tag: '@NJM-154760' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const days = Number(readBackupValue('LICENSE_EXPIRY_DAYS'));
  if (!Number.isInteger(days) || days <= 1) throw new Error(`ABORTED: NAKIVO_BK_LICENSE_EXPIRY_DAYS must be a whole number of days greater than 1 (got "${days}")`);

  await test.step('1. Precondition: a license with a defined expiry is applied (value from .env)', async () => {
    expect(days).toBeGreaterThan(1);
  });

  await test.step('2. Open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Observe the license details label in the right-pane footer: it is visible', async () => {
    const label = await flows.readLicenseLabel();
    testInfo.annotations.push({ type: 'observed-outcome', description: `license label: "${label.text}"` });
    expect(label.text).toMatch(/licen[sc]e/i);
  });

  await test.step('4. Read the expiration text: it matches "License expires in X days" with the expected number of days', async () => {
    const expiry = BkA3SourcesFlows.parseExpiry((await flows.readLicenseLabel()).text);
    expect(expiry, 'no "expires in N days|hours" text in the label').toBeDefined();
    expect(expiry?.unit).toBe('days');
    expect([days, days - 1]).toContain(expiry?.value);
  });

  await flows.leaveWizard();
});
