import { test as base, expect, type Page } from '@playwright/test';
import { viewingPause, withPausedTime } from '../helpers/viewing-pause';
import { readBaseUrl, readCredentials, readMssqlAgTarget, readMssqlFciTarget, readMssqlInstanceTarget, readMssqlLowPermLogin, readMssqlOldAgTarget, readMssqlOldInstanceTarget, readMssqlReadScaleTarget, type Credentials, type MssqlAgTarget, type MssqlFciTarget, type MssqlInstanceTarget, type MssqlLowPermLogin } from '../helpers/credentials';
import { InventoryFlows } from '../flows/inventory.flows';
import { WizardFlows } from '../flows/wizard.flows';
import { BackupFlows } from '../flows/backup.flows';
import { RemoveHostFlows } from '../flows/remove-host.flows';
import { BackupJobPage } from '../pages/backup-job.page';
import { BackupWizardPage } from '../pages/backup-wizard.page';
import { AddInventoryItemPage } from '../pages/add-inventory-item.page';
import { EditInventoryItemPage } from '../pages/edit-inventory-item.page';
import { NodesPage } from '../pages/nodes.page';
import { InventoryItemPage } from '../pages/inventory-item.page';
import { InventoryPage } from '../pages/inventory.page';
import { LoginPage } from '../pages/login.page';
import { OverviewPage } from '../pages/overview.page';

// The Add wizard page handed to a spec pauses after each Next (the viewing pause), as InventoryFlows.nextStep() does for the flows.
// The pause lives here, not in the page object (pages never pause), so the specs that call addInventoryItemPage.next() directly get it
// without being edited. The page's next() already waits for the Options step (the Hostname input) before it returns, so the pause
// comes after the screen has changed. Flows build their own page object, so nothing is paused twice.
function withNextPause(addPage: AddInventoryItemPage): AddInventoryItemPage {
  const next = addPage.next.bind(addPage);
  addPage.next = async () => {
    await next();
    await viewingPause();
  };
  return addPage;
}

type Fixtures = {
  loginPage: LoginPage;
  overviewPage: OverviewPage;
  inventoryPage: InventoryPage;
  addInventoryItemPage: AddInventoryItemPage;
  inventoryItemPage: InventoryItemPage;
  editInventoryItemPage: EditInventoryItemPage;
  inventoryFlows: InventoryFlows;
  wizardFlows: WizardFlows;
  removeHostFlows: RemoveHostFlows;
  backupFlows: BackupFlows;
  backupWizardPage: BackupWizardPage;
  backupJobPage: BackupJobPage;
  nodesPage: NodesPage;
  credentials: Credentials;
  mssqlAgTarget: MssqlAgTarget;
  mssqlFciTarget: MssqlFciTarget;
  mssqlInstanceTarget: MssqlInstanceTarget;
  mssqlReadScaleTarget: MssqlAgTarget;
  // Targets that run an unsupported (too old) SQL Server version: NAKIVO_MSSQL_OLD_<INSTANCE|FCI|AG|READSCALE>_* in .env.
  mssqlOldInstanceTarget: MssqlInstanceTarget;
  mssqlOldFciTarget: MssqlFciTarget;
  mssqlOldAgTarget: MssqlAgTarget;
  mssqlOldReadScaleTarget: MssqlAgTarget;
  // A SQL login without the rights NBR needs: NAKIVO_MSSQL_LOWPERM_SQL_USERNAME / _SQL_PASSWORD in .env.
  mssqlLowPermLogin: MssqlLowPermLogin;
  signedIn: void;
};

// One signed-in browser page shared by every test that runs in the worker (a continuous visible session).
// Used by suites that must not reopen the browser or sign in again for each case.
type InventorySession = {
  page: Page;
  inventoryPage: InventoryPage;
  addInventoryItemPage: AddInventoryItemPage;
  inventoryItemPage: InventoryItemPage;
  editInventoryItemPage: EditInventoryItemPage;
  nodesPage: NodesPage;
  mssqlAgTarget: MssqlAgTarget;
  mssqlFciTarget: MssqlFciTarget;
  mssqlInstanceTarget: MssqlInstanceTarget;
  mssqlReadScaleTarget: MssqlAgTarget;
};

export type { InventorySession };

type WorkerFixtures = {
  inventorySession: InventorySession;
};

// Test-scoped fixtures: page objects, the credentials, the base URL and the MSSQL target from .env, and a UI sign-in.
// No business assertions; the only check is the signed-in fixture's own contract (the Logout marker).
export const test = base.extend<Fixtures, WorkerFixtures>({
  // Worker-scoped: the context is opened once, signed in once (UI login, no storageState) and closed when the worker ends.
  inventorySession: [
    async ({ browser }, use) => {
      // Headed runs follow the (maximized) browser window. A headless window is small and the Director's dialogs then do not
      // show (the Remove confirmation did not open), so a window narrower than 1200 px gets a fixed 1600x900 viewport.
      const options = { baseURL: readBaseUrl(), ignoreHTTPSErrors: true };
      let context = await browser.newContext({ ...options, viewport: null });
      let page = await context.newPage();
      if ((await page.evaluate(() => window.innerWidth)) < 1200) {
        await context.close();
        context = await browser.newContext({ ...options, viewport: { width: 1600, height: 900 } });
        page = await context.newPage();
      }
      const loginPage = new LoginPage(page);
      const overviewPage = new OverviewPage(page);
      const { username, password } = readCredentials();
      await loginPage.goto();
      await loginPage.signIn(username, password);
      await expect(overviewPage.logoutMarker, 'inventorySession fixture: the Logout marker is not visible after signing in').toBeVisible();
      const inventoryPage = new InventoryPage(page);
      await inventoryPage.goto();
      await use({ page, inventoryPage, addInventoryItemPage: withNextPause(new AddInventoryItemPage(page)), inventoryItemPage: new InventoryItemPage(page), editInventoryItemPage: new EditInventoryItemPage(page), nodesPage: new NodesPage(page), mssqlAgTarget: readMssqlAgTarget(), mssqlFciTarget: readMssqlFciTarget(), mssqlInstanceTarget: readMssqlInstanceTarget(), mssqlReadScaleTarget: readMssqlReadScaleTarget() });
      await context.close();
    },
    { scope: 'worker' },
  ],
  // Playwright's baseURL comes from NAKIVO_BASE_URL in .env, not from playwright.config.ts.
  baseURL: async ({}, use) => {
    await use(readBaseUrl());
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  overviewPage: async ({ page }, use) => {
    await use(new OverviewPage(page));
  },
  inventoryPage: async ({ page }, use) => {
    await use(new InventoryPage(page));
  },
  addInventoryItemPage: async ({ page }, use) => {
    await use(withNextPause(new AddInventoryItemPage(page)));
  },
  inventoryItemPage: async ({ page }, use) => {
    await use(new InventoryItemPage(page));
  },
  editInventoryItemPage: async ({ page }, use) => {
    await use(new EditInventoryItemPage(page));
  },
  inventoryFlows: async ({ page }, use) => {
    await use(new InventoryFlows(page));
  },
  wizardFlows: async ({ page }, use) => {
    await use(new WizardFlows(page));
  },
  removeHostFlows: async ({ page }, use) => {
    await use(new RemoveHostFlows(page));
  },
  backupFlows: async ({ page }, use) => {
    await use(new BackupFlows(page));
  },
  backupWizardPage: async ({ page }, use) => {
    await use(new BackupWizardPage(page));
  },
  backupJobPage: async ({ page }, use) => {
    await use(new BackupJobPage(page));
  },
  nodesPage: async ({ page }, use) => {
    await use(new NodesPage(page));
  },
  mssqlInstanceTarget: async ({}, use) => {
    await use(readMssqlInstanceTarget());
  },
  mssqlOldInstanceTarget: async ({}, use) => {
    await use(readMssqlOldInstanceTarget('INSTANCE'));
  },
  mssqlOldFciTarget: async ({}, use) => {
    await use(readMssqlOldInstanceTarget('FCI'));
  },
  mssqlOldAgTarget: async ({}, use) => {
    await use(readMssqlOldAgTarget('AG'));
  },
  mssqlLowPermLogin: async ({}, use) => {
    await use(readMssqlLowPermLogin());
  },
  mssqlOldReadScaleTarget: async ({}, use) => {
    await use(readMssqlOldAgTarget('READSCALE'));
  },
  credentials: async ({}, use) => {
    await use(readCredentials());
  },
  mssqlAgTarget: async ({}, use) => {
    await use(readMssqlAgTarget());
  },
  mssqlFciTarget: async ({}, use) => {
    await use(readMssqlFciTarget());
  },
  mssqlReadScaleTarget: async ({}, use) => {
    await use(readMssqlReadScaleTarget());
  },
  // UI login per test (no storageState, no cache). Contract: the page is signed in as the configured user.
  signedIn: async ({ loginPage, overviewPage, credentials }, use) => {
    await loginPage.goto();
    await loginPage.signIn(credentials.username, credentials.password);
    await expect(overviewPage.logoutMarker, 'signedIn fixture: the Logout marker is not visible after signing in').toBeVisible();
    await use();
  },
});

export { expect };

// Owner request: pause STEP_DELAY_MS after each step. Wraps test.step once, so every spec that imports `test` from here gets it.
// The pause is a deliberate viewing delay (not a synchronization wait); a failed step skips it and rethrows at once.
// The test timeout is extended by the same amount first, so the pause never uses up the budget a spec set (or the 30 s default).
const originalStep = test.step.bind(test);
(test as { step: typeof test.step }).step = (async (title: string, body: () => unknown, options?: object) => {
  const result = await originalStep(title, body as never, options as never);
  await viewingPause();
  return result;
}) as typeof test.step;

// A spec that calls test.setTimeout(x) after some pauses would otherwise lose the time they added: x replaces the whole timeout.
// Inside a test the pauses taken so far are added back; outside one (a describe-level call) the value passes through unchanged.
const originalSetTimeout = test.setTimeout.bind(test);
(test as { setTimeout: typeof test.setTimeout }).setTimeout = ((timeout: number) => originalSetTimeout(withPausedTime(timeout))) as typeof test.setTimeout;
