import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-171440: "Backup - Step 3 - Schedule - Keep backups for".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login, also used to read msdb).
// Side effects: creates job NJM-171440 with one Weekly schedule, "Keep backups for 3 days"; runs it twice on demand (two Full backups of the database); afterEach deletes the job (backups kept).
// case-vs-ui: the case sets retention as "<N> recovery points (or <N> days)" and runs "enough times to exceed the retention count". 11.2.1 retention is inline "Keep backups for <n> days | weeks | months"
//   (no recovery-point count), and expiry works on the system time ("The removal of the expired recovery points happens based on the system time."), so no recovery point can expire during a test.
//   Steps 4-6 are therefore: the value is saved, the Run dialog offers "Keep recovery point for 3 days", two runs keep BOTH recovery points and the chain stays restorable (both Full, none removed).
//   Enforcement of the limit (oldest removed) is NOT checked.
// case-vs-ui: the run dialog's SQL backup type (shown after the first Full) is set to Full on the second run so the retained chain is two independent Full backups.
// UNVERIFIED: the text of the Run dialog schedule combo after a Keep value change (notes: "<name> - Weekly (Keep recovery point for 10 days)") and the Keep info icon (qmMain after the unit).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-171440');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try {
    await backupFlows.discardJobIfPresent(JOB);
  } catch {
    // Best effort: the original failure is what the report shows.
  }
  jobCreated = false;
});

test('NAKIVO saves the Keep backups for retention of a schedule and keeps the recovery points created within it', { tag: '@NJM-171440' }, async ({ signedIn: _s, page, backupFlows, backupJobPage }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let before: Awaited<ReturnType<typeof host.backupHistory>> = [];

  await test.step('1. Precondition: the database is in Inventory, the repository is Online and selectable, no job named NJM-171440 exists', async () => {
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
    before = await host.backupHistory(db, 50);
  });

  await test.step('2. Open Data Protection > + > Backup for Database, select the database and the repository and go to the Schedule step', async () => {
    await a6.openScheduleStep(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
    await expect(a6.ui.keepCountInput(0)).toHaveValue('10');
  });

  await test.step('3. Set "Keep backups for" 3 days: the retention value is accepted and its tooltip explains the removal time', async () => {
    await a6.fillSchedule(0, { name: 'keep 3 days', keepFor: { count: 3, unit: 'days' } });
    await expect(a6.ui.keepCountInput(0)).toHaveValue('3');
    await expect(a6.ui.keepUnitInput(0)).toHaveValue(/day/i);
    const tip = (await a6.hoverTexts(a6.ui.keepInfoIcon(0))).join(' ');
    testInfo.annotations.push({ type: 'observed-outcome', description: `Keep backups for tooltip: "${tip}"` });
    expect(tip).toContain('The removal of the expired recovery points happens based on the system time.');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'retention is days | weeks | months in 11.2.1, not a recovery-point count' });
  });

  await test.step('4. Finish the job and run it twice: two recovery points are created', async () => {
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finish');
    jobCreated = true;
    await backupFlows.openJob(JOB);
    await backupJobPage.runButton.click({ timeout: 10_000 });
    await backupJobPage.runDialog.waitFor({ timeout: 15_000 });
    const dialogText = await backupJobPage.runDialog.innerText();
    testInfo.annotations.push({ type: 'observed-outcome', description: `Run dialog text: ${dialogText.replace(/\s+/g, ' ')}` });
    expect(dialogText).toMatch(/Keep recovery points? for 3 days/i);
    await backupJobPage.runDialogRunButton.click({ timeout: 10_000 });
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    await backupFlows.runOpenJob({ sqlBackupType: 'Full' });
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
  });

  await test.step('5. Open the recovery points of the database: both recovery points are retained (none can expire within 3 days)', async () => {
    const rows = await a6.newNbrBackups(host, db, before);
    expect(rows.length, 'fewer than two new NAKIVO backups in msdb').toBeGreaterThanOrEqual(2);
  });

  await test.step('6. The retained chain stays consistent: both recovery points are Full backups, so each is restorable on its own', async () => {
    const rows = await a6.newNbrBackups(host, db, before);
    for (const row of rows) expect(row.type).toBe('D');
    await a6.openEditSchedule(JOB);
    const state = await a6.readSchedule(0);
    expect(state.keepCount).toBe('3');
    expect(state.keepUnit).toMatch(/day/i);
    await a6.closeEditor();
  });
});
