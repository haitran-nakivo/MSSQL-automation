import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupRepo, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows, type Session } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154767: "[DBM-BK-UI-Source-Left Pane-0019-8] Verify Race Condition Check on Finish".
// Env (.env, owner-supplied): NAKIVO_BK_LICENSE_REMAINDER_1 = 1 (the owner confirms exactly ONE database license is left; the test also checks the label), NAKIVO_BK_LICENSE_DB_1 and
//   NAKIVO_BK_LICENSE_DB_2 = two distinct databases of NAKIVO_BK_INSTANCE_ITEM (DB_1 is selected in the wizard under test, DB_2 is consumed by the external job),
//   NAKIVO_BK_REPO_PRIMARY. Missing / other value: ABORTED. Never changes licensing itself; the license is consumed by a second signed-in session creating an ordinary job.
// Side effects: creates job NJM-154767-ext (DB_2, on demand, never run) in a second browser session; both it and the wizard under test are removed / cancelled; no job NJM-154767 may remain.
// case-vs-ui: "in a separate session, create another job" = a second browser context signed in as the same user; the external job's database counts against the license once saved.
// case-vs-ui: the alert on Finish is asserted by its wording from the case; if the Director instead blocks at an earlier step the test records it as observed-outcome and fails on the alert check.
test.use(RUN_OPTIONS);

const WIZARD_JOB = backupJobName('NJM-154767');
const EXTERNAL_JOB = backupJobName('NJM-154767', '-ext');
let session: Session | undefined;
test.afterEach(async ({ page }) => {
  try {
    await session?.close();
  } catch {
    /* best effort */
  }
  session = undefined;
  const flows = new BkA3SourcesFlows(page);
  for (const name of [WIZARD_JOB, EXTERNAL_JOB]) {
    try {
      await flows.backup.discardJobIfPresent(name);
    } catch {
      /* best effort */
    }
  }
});

test('NAKIVO re-checks the license on Finish and alerts when another job consumed the last database license', { tag: '@NJM-154767' }, async ({ signedIn: _s, page, browser, baseURL, credentials }, testInfo) => {
  test.setTimeout(600_000);
  const flows = new BkA3SourcesFlows(page);
  const remainder = readBackupValue('LICENSE_REMAINDER_1');
  const db1 = readBackupValue('LICENSE_DB_1');
  const db2 = readBackupValue('LICENSE_DB_2');
  const item = readBackupValue('INSTANCE_ITEM');
  const repo = readBackupRepo('PRIMARY');
  if (remainder !== '1') throw new Error(`ABORTED: NAKIVO_BK_LICENSE_REMAINDER_1 must be 1 (got "${remainder}")`);
  if (!baseURL) throw new Error('ABORTED: the base URL (NAKIVO_BASE_URL) is not set');

  await test.step('1. Precondition and 2. open the wizard: exactly one database license remains', async () => {
    await flows.openStep1();
    const left = await flows.readRemainingDatabases();
    if (left !== 1) throw new Error(`ABORTED: the license label shows ${left ?? 'no counter'} databases remaining, the case needs exactly 1`);
  });

  await test.step('3. Select one database (within the limit): the selection is accepted with no alert', async () => {
    await flows.clickCheckbox(db1);
    await expect.poll(() => flows.isChecked(db1), { timeout: 10_000 }).toBe(true);
    await expect(flows.sources.licenseAlert()).toBeHidden();
  });

  await test.step('4. In a separate session create another job that consumes the last remaining database license', async () => {
    session = await flows.openSession(browser, baseURL, credentials.username, credentials.password);
    const other = new BkA3SourcesFlows(session.page);
    await other.openStep1();
    await other.backup.selectSources([{ item, databases: [db2] }]);
    await other.fillToOptions(repo, EXTERNAL_JOB);
    await other.backup.wizard.finishButton.click({ timeout: 10_000 });
    await other.waitJobPage();
    expect(await other.backup.jobExists(EXTERNAL_JOB)).toBe(true);
    await session.close();
    session = undefined;
  });

  await test.step('5. Return to the wizard and click Finish: a "Not enough licenses to proceed" alert appears', async () => {
    await flows.fillToOptions(repo, WIZARD_JOB);
    await flows.backup.wizard.finishButton.click({ timeout: 10_000 });
    const shown = await flows.sources.licenseAlert().isVisible().catch(() => false);
    testInfo.annotations.push({ type: 'observed-outcome', description: `alert visible right after Finish: ${shown}` });
    await expect(flows.sources.licenseAlert()).toBeVisible({ timeout: 15_000 });
    await expect(flows.sources.licenseAlert()).toContainText(/Not enough licenses to proceed/i);
  });

  await test.step('Ad hoc (negative): the job from the wizard was not created', async () => {
    await flows.leaveWizard();
    expect(await flows.backup.jobExists(WIZARD_JOB)).toBe(false);
  });
});
