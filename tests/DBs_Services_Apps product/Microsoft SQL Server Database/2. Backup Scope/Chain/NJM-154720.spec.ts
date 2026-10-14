import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../flows/bkA2-wizard.flows';

// NJM-154720: "[MSSQL-BK-General-0001] Verify Middleware Requirements (Scope)" (the SQL job has the common DbM features: job naming, scheduling, notifications).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: creates the on-demand job NJM-154720 (never run; deleted in afterEach).
// PARTIAL: the referenced requirement set "DBM - Backups - General" is not available, so only the three features named in the case are checked: a job name can be set and is kept, the schedule
//   options exist, and the report-notification option ("Send job run reports to") exists. Sending an e-mail is not exercised.
// case-vs-ui: "configure a notification" is the Options-step checkbox "Send job run reports to" (pre-ticked with the user's e-mail in 11.2.1).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154720');
let jobCreated = false;

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO database backup job offers the common middleware features: job name, scheduling and report notifications', { tag: '@NJM-154720' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupWizardPage, backupJobPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the SQL Server item is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(item))) throw new Error(`ABORTED: the Inventory item "${item}" is not listed`);
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named "${JOB}" already exists; remove it and run again`);
  });

  await test.step('2. Scheduling is available on the Schedule step: Do not schedule, schedule type and SQL backup type', async () => {
    await wiz.walkTo('Schedule', { item, databases: [db], repo });
    await expect(backupWizardPage.onDemandCheckbox).toBeVisible();
    expect(await wiz.textVisible('SQL backup type', false)).toBe(true);
    expect(await wiz.textVisible('Keep backups for', false)).toBe(true);
  });

  await test.step('3. Job naming and notification: the Options step has a Job name and the "Send job run reports to" option', async () => {
    await backupFlows.next();
    await expect(backupWizardPage.jobNameField).toBeVisible();
    await backupFlows.setJobName(JOB);
    await expect(backupWizardPage.jobNameField).toHaveValue(JOB);
    await expect(backupWizardPage.optionCheckbox('Send job run reports to')).toBeVisible();
  });

  await test.step('4. Finish: the job is created with the chosen name', async () => {
    await backupWizardPage.finishButton.click({ timeout: 10_000 });
    jobCreated = true;
    await expect(backupJobPage.statusLine).toBeVisible({ timeout: 30_000 });
    await backupFlows.gotoJobs();
    await expect(backupJobPage.jobRow(JOB)).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'DBM-General requirement text unavailable; only job name, schedule options and the report option are checked.' });
  });
});
