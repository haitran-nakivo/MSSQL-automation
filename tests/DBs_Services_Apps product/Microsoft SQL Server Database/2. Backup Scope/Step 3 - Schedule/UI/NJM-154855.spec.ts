import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154855: "[MSSQL-BK-UI-Sche-0005-1] Verify Stateless Icon Display".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: none (the wizard is opened and left without saving a job).
// case-vs-ui: no Schedule card in 11.2.1, and a script cannot tell whether an image "matches asset SQLD003" (the design asset id is not in the DOM that the notes describe). What is asserted: an icon (the
//   info icon) is rendered next to the SQL backup type of the schedule block and has a non-empty box; its class / background is attached as observed-outcome for the owner to compare with SQLD003.
// UNVERIFIED: the icon is found as the first qmMain element after the combo (pages/bkA6-schedule.page.ts sqlTypeInfoIcon).
test.use(RUN_OPTIONS);

test('NAKIVO shows an icon next to the SQL backup type of the schedule', { tag: '@NJM-154855' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
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
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Create a schedule and inspect the icon next to the backup type: the icon is rendered (asset SQLD003 is not comparable by script)', async () => {
    await a6.fillSchedule(0, { sqlBackupType: 'Differential' });
    const icon = a6.ui.sqlTypeInfoIcon(0);
    await expect(icon, 'no icon is rendered next to the SQL backup type').toBeVisible();
    const box = await icon.boundingBox();
    expect(box && box.width > 0 && box.height > 0, 'the icon has an empty box').toBe(true);
    const look = await icon.evaluate((element) => `class="${element.className}" background="${getComputedStyle(element).backgroundImage}"`);
    testInfo.annotations.push({ type: 'observed-outcome', description: `icon next to SQL backup type: ${look}` });
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'no Schedule card in 11.2.1; asset SQLD003 not comparable by script; only the presence of the icon is asserted' });
  });
});
