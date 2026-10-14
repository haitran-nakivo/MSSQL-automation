import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154843: "[DBM-BK-UI-Schedule-0004] Verify Immutability Field & Dialog".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_IMMUTABLE (an Online repository that supports immutability),
//   NAKIVO_BK_IMMUTABLE_DAYS (the number of days to enter), plus the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource. A missing value ends the test ABORTED.
// Side effects: none (the wizard is opened and left without saving a job).
// case-vs-ui: 11.2.1 has no Create/Edit schedule dialog: the field is looked for in the inline Schedule #1 block. The notes of the explored UI do not list an "Immutable for"
//   field on the Schedule step (it was explored with the Onboard and an Azure repository only), so what the field looks like is UNVERIFIED: it is found by the text "immutab".
// UNVERIFIED: pages/bkA6-schedule.page.ts immutableLabel / immutableCheckbox / immutableDaysInput.
test.use(RUN_OPTIONS);

test('NAKIVO shows the Immutable for field on the schedule when the destination repository supports immutability and accepts a period in days', { tag: '@NJM-154843' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('IMMUTABLE');
  const days = readBackupValue('IMMUTABLE_DAYS');
  const a6 = new BkA6ScheduleFlows(page, backupFlows);

  await test.step('1. Precondition: open Data Protection > + > Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    expect(days, 'NAKIVO_BK_IMMUTABLE_DAYS must be a whole number of days').toMatch(/^[1-9][0-9]*$/);
    await backupFlows.openWizard();
    await expect(backupWizardPage.title).toBeVisible();
  });

  await test.step('2. Select a database and the immutable-capable repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Open the schedule editor: the inline Schedule #1 block is the editor (no Create Schedule dialog exists)', async () => {
    await expect(a6.ui.block(0)).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'no Create/Edit schedule dialog in 11.2.1; the schedule is edited inline in Step 3' });
  });

  await test.step('4. Locate the "Immutable for" field: it is visible in the schedule', async () => {
    expect(await a6.hasImmutableControl(0), 'the schedule shows no immutability control for the immutable-capable repository').toBe(true);
    await expect(a6.ui.immutableLabel(0)).toBeVisible();
    testInfo.annotations.push({ type: 'observed-outcome', description: `immutability control text: ${await a6.ui.immutableLabel(0).innerText()}` });
  });

  await test.step('5. Enter the immutability period in days: the field accepts it', async () => {
    await a6.setImmutable(0, Number(days));
    await expect(a6.ui.immutableDaysInput(0)).toHaveValue(days);
  });

  await test.step('Ad hoc (negative): the wizard is cancelled and no job is created', async () => {
    await a6.closeEditor();
    await expect(backupWizardPage.title).toBeHidden({ timeout: 15_000 });
  });
});
