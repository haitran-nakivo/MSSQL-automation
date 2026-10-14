import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../flows/bkA2-wizard.flows';

// NJM-154702: "[MSSQL-BK-WF-0003] Verify Schedule Step" (schedule and retention are accepted and saved).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: creates the job NJM-154702 with one weekly schedule (never run by the test; deleted in afterEach).
// case-vs-ui: "Daily schedule; GFS retention" has no equivalent: the Schedule types are Weekly / Monthly / Yearly / Periodic / After another job, and retention is the single inline field "Keep backups
//   for N days|weeks|months" (no GFS). The spec configures a Weekly schedule (all days is the wizard's Mon-Fri default, kept) with "Keep backups for 10 days".
//   UNVERIFIED: after Finish, the Run dialog's schedule combo is expected to show "<name> - Weekly (Keep recovery point for 10 days)" (notes), read as proof of "saved and shown as configured".
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154702');
const SCHEDULE = 'NJM-154702-weekly';
let jobCreated = false;

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO Schedule step accepts a schedule with retention and shows it as configured on the saved job', { tag: '@NJM-154702' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupWizardPage, backupJobPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the SQL Server instance is in Inventory and no job named NJM-154702 exists', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(item))) throw new Error(`ABORTED: the Inventory item "${item}" is not listed`);
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named "${JOB}" already exists; remove it and run again`);
  });

  await test.step('2. Start Create > Backup for Database and select the target database', async () => {
    await backupFlows.openWizard();
    await backupFlows.selectSources([{ item, databases: [db] }]);
    expect(await wiz.sourceSummaryText()).not.toContain('Select at least one item on the left');
  });

  await test.step('3. Proceed to Destination and select the stream repository', async () => {
    await backupFlows.next();
    await backupFlows.chooseDestination(repo);
    await expect(backupWizardPage.destinationCombo).toHaveValue(new RegExp(repo));
  });

  await test.step('4. Proceed to Schedule and configure a schedule and a retention policy: the step accepts them', async () => {
    await backupFlows.next();
    await backupFlows.fillSchedule({ name: SCHEDULE, type: 'Weekly', keepFor: { count: 10, unit: 'days' } });
    await expect(backupWizardPage.scheduleField('scheduleName')).toHaveValue(SCHEDULE);
    await expect(backupWizardPage.scheduleField('type')).toHaveValue('Weekly');
    await expect(backupWizardPage.scheduleField('customKeepSavepointCount')).toHaveValue('10');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Case: Daily schedule + GFS retention. UI: Weekly schedule + inline "Keep backups for 10 days" (no Daily type, no GFS).' });
  });

  await test.step('5. Finish the wizard and review the schedule and retention on the saved job', async () => {
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await backupWizardPage.finishButton.click({ timeout: 10_000 });
    jobCreated = true;
    await backupJobPage.runButton.waitFor({ timeout: 30_000 });
    await backupJobPage.runButton.click({ timeout: 10_000 });
    await backupJobPage.runDialog.waitFor({ timeout: 15_000 });
    const combo = backupJobPage.runDialog.getByText('Select schedule', { exact: false }).first().locator('xpath=following::input[1]');
    const dialogText = (await backupJobPage.runDialog.innerText()).replace(/\s+/g, ' ');
    const comboValue = await combo.inputValue().catch(() => '');
    testInfo.annotations.push({ type: 'observed-outcome', description: `Run dialog: schedule combo "${comboValue}"; dialog text: ${dialogText.slice(0, 300)}` });
    expect(`${comboValue} ${dialogText}`).toContain(SCHEDULE);
    expect(`${comboValue} ${dialogText}`).toMatch(/10 days/);
    await backupJobPage.runDialog.getByText('Cancel', { exact: true }).last().click({ timeout: 10_000 });
  });
});
