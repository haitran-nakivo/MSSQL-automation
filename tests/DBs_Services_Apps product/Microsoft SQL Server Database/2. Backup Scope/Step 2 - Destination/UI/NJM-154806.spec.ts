import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154806: "[DBM-BK-UI-Dest-0015-2-2] Verify Default Dest Behavior".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). "Behaves like the Fast setup dropdown": the list opens, a repository is picked and shown in the combo.
//   "Inherit" is checked by expanding a child database row and reading its own destination combo.
// UNVERIFIED: a child row of a ticked item shows its Destination combo (inferred from the single-database row in the notes) and inherits the default value.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO applies the container Default Destination to its child databases without an override', { tag: '@NJM-154806' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  const repoPattern = new RegExp(repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the whole SQL item and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. In Advanced setup select a repository in the container Default Destination: the combo shows it', async () => {
    await dest.openAdvanced();
    await dest.ensureBlockOpen(source.item);
    await dest.setDefaultDestination(repo);
    await expect(dest.defaultDestinationCombo()).toHaveValue(repoPattern);
  });
  await test.step('4. Inspect a child database with no override: it shows the default repository', async () => {
    await dest.toggle(db);
    await expect(dest.rowCombo(db)).toHaveValue(repoPattern);
  });
});
