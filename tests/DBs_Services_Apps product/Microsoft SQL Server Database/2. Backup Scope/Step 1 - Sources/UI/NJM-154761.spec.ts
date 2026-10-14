import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154761: "[DBM-BK-UI-Source-Left Pane-0019-3] Verify Expiration Hidden for Tenant".
// Env (.env, owner-supplied): NAKIVO_BK_TENANT_USERNAME, NAKIVO_BK_TENANT_PASSWORD = a multi-tenant (self-service) tenant login of this Director whose Inventory has a SQL item,
//   and the Director's license must have an expiry (so the main user sees "License expires in ..."; the same license as NJM-154760). Missing value: ABORTED ("Missing in .env").
//   The test never changes licensing or creates a tenant.
// Side effects: none (signs in as the tenant, opens the wizard and cancels it). Does not use the signedIn fixture (it signs in as the main user).
// case-vs-ui: UNVERIFIED: a tenant may not have the same Data Protection route or a SQL item; the test then fails on step 2. The tenant login uses the same login screen.
// Ad hoc (positive control): before the tenant step the main user's label is read to prove the license has an expiration to hide.
test.use(RUN_OPTIONS);

test('NAKIVO hides the license expiration from a tenant user in the Step 1 license label', { tag: '@NJM-154761' }, async ({ page, loginPage, overviewPage, credentials }, testInfo) => {
  test.setTimeout(400_000);
  const flows = new BkA3SourcesFlows(page);
  const tenantUser = readBackupValue('TENANT_USERNAME');
  const tenantPassword = readBackupValue('TENANT_PASSWORD');

  await test.step('Ad hoc (positive control): the main user sees an expiration in the label', async () => {
    await loginPage.goto();
    await loginPage.signIn(credentials.username, credentials.password);
    await expect(overviewPage.logoutMarker).toBeVisible();
    await flows.openStep1();
    const label = await flows.readLicenseLabel();
    testInfo.annotations.push({ type: 'observed-outcome', description: `main user license label: "${label.text}"` });
    if (!BkA3SourcesFlows.parseExpiry(label.text)) throw new Error('ABORTED: the Director license shows no expiration to the main user, so there is nothing to hide from the tenant');
    await flows.leaveWizard();
    await overviewPage.logoutMarker.click({ timeout: 10_000 });
  });

  await test.step('1. Log in to Director as a tenant user: the session is active', async () => {
    await loginPage.goto();
    await loginPage.signIn(tenantUser, tenantPassword);
    await expect(overviewPage.logoutMarker).toBeVisible();
  });

  await test.step('2. Open the Backup for Database wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Observe the license details label: it is shown', async () => {
    const label = await flows.readLicenseLabel();
    testInfo.annotations.push({ type: 'observed-outcome', description: `tenant license label: "${label.text}"` });
    expect(label.text).toMatch(/licen[sc]e/i);
  });

  await test.step('4. Confirm the expiration portion: it is hidden for the tenant user', async () => {
    const label = await flows.readLicenseLabel();
    expect(BkA3SourcesFlows.parseExpiry(label.text)).toBeUndefined();
    expect(label.text).not.toMatch(/expires?/i);
  });

  await flows.leaveWizard();
});
