import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154807: "[DBM-BK-UI-Dest-0015-2-3] Verify Sync from Fast Setup".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The whole item is ticked so that a container block with a Default Destination exists.
// Ad hoc: the Fast setup dropdown still shows the repository after the switch to Advanced setup.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO pre-sets the container Default Destination to the repository chosen in Fast setup', { tag: '@NJM-154807' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
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
  await test.step('3. Select a repository in Fast setup, then click Advanced setup: the container default is pre-set', async () => {
    await backupFlows.chooseDestination(repo);
    await expect(dest.fastCombo).toHaveValue(repoPattern);
    await dest.openAdvanced();
    await dest.ensureBlockOpen(source.item);
    await expect(dest.defaultDestinationCombo()).toHaveValue(repoPattern);
  });
  await test.step('4. Confirm the container default equals the Fast setup selection', async () => {
    expect(await dest.defaultDestinationCombo().inputValue()).toBe(await dest.fastValue());
  });
});
