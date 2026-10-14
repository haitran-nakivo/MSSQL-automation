import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154846: "[MSSQL-BK-UI-Sche-0003-1] Verify SQL Backup Type Required".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: none (the wizard is opened and left without saving a job).
// case-vs-ui: no Create Schedule dialog and no schedule "Save": the block is inline and the wizard's Next / Finish is what saves. The combo is pre-filled with Full, so "required" is shown
//   by the combo never being empty: if it is a read-only combo it cannot be cleared; if it is editable, clearing it must flag the field invalid and block Next.
// UNVERIFIED: whether the combo is editable (not recorded in the notes), so both outcomes are handled.
test.use(RUN_OPTIONS);

test('NAKIVO does not let the SQL backup type of a schedule be left empty', { tag: '@NJM-154846' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const a6 = new BkA6ScheduleFlows(page, backupFlows);

  await test.step('1. Precondition: open Data Protection > + > Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupWizardPage.title).toBeVisible();
  });

  await test.step('2. Select a database, go to Destination, select the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.sqlTypeInput(0)).toBeVisible();
  });

  await test.step('3. Try to clear the SQL backup type selection (select all, Delete)', async () => {
    await a6.clearByKeyboard(a6.ui.sqlTypeInput(0));
    const editable = await a6.isEditable(a6.ui.sqlTypeInput(0));
    testInfo.annotations.push({ type: 'observed-outcome', description: `SQL backup type combo editable: ${editable}; value after the clear attempt: "${await a6.ui.sqlTypeInput(0).inputValue()}"` });
    if (!editable) {
      await expect(a6.ui.sqlTypeInput(0), 'a read-only combo must keep a value').toHaveValue('Full');
    } else {
      expect(await backupFlows.isInvalid(a6.ui.sqlTypeInput(0)), 'the emptied SQL backup type is not flagged as required').toBe(true);
    }
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'the combo is pre-filled (Full); "empty / no selection" is only reachable if the combo is editable' });
  });

  await test.step('4. Attempt to continue (Next, the step that saves the schedule) with the type empty: blocked only when it could be emptied', async () => {
    if (await a6.isEditable(a6.ui.sqlTypeInput(0))) {
      await backupFlows.next({ blocked: true });
      await expect(backupWizardPage.jobNameField).toBeHidden();
    } else {
      await backupFlows.next();
      await expect(backupWizardPage.jobNameField).toBeVisible();
    }
  });

  await test.step('Ad hoc: the wizard is cancelled and no job is created', async () => {
    await a6.closeEditor();
    await expect(backupWizardPage.title).toBeHidden({ timeout: 15_000 });
  });
});
