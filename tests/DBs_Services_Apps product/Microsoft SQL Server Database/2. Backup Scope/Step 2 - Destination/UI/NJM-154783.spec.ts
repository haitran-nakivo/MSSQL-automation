import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154783: "[DBM-BK-UI-Dest-0002-4] Verify 'Different containers selected' Text".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI).
// case-vs-ui: the text is "Different backup repositories selected" (memory note nakivo-db-backup-job-wizard), not "Different containers selected".
// UNVERIFIED: a database row's destination combo is the first input after the row name once the row is expanded.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO shows the mixed-targets text in the Fast setup dropdown when two databases use different repositories', { tag: '@NJM-154783' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case text is "Different containers selected"; the UI shows "Different backup repositories selected".' });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const dbA = readBackupDatabase('INSTANCE', 'SIMPLE');
  const dbB = readBackupDatabase('INSTANCE', 'FULL');
  const repoA = readBackupRepo('PRIMARY');
  const repoB = readBackupRepo('SECONDARY');

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick two databases and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [dbA, dbB] }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. Switch to Advanced setup and assign the two databases to two different repositories', async () => {
    await dest.openAdvanced();
    await dest.setRowDestination(dbA, repoA);
    await dest.setRowDestination(dbB, repoB);
    await expect(dest.rowCombo(dbA)).toHaveValue(new RegExp(repoA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(dest.rowCombo(dbB)).toHaveValue(new RegExp(repoB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  await test.step('4. Read the Fast setup dropdown: it shows the mixed-targets text instead of a single repository name', async () => {
    await expect(dest.fastCombo).toHaveValue('Different backup repositories selected');
    expect(await dest.fastValue()).not.toContain('Different containers selected');
  });
});
