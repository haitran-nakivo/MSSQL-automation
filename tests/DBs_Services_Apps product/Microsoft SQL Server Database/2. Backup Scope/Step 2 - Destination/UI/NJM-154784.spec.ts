import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154784: "[DBM-BK-UI-Dest-0002-5] Verify Repository List Content".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI).
// Partial: the full comparison with Configuration > Repositories is not automated (that page was not explored); the spec asserts that the repositories
//   the owner named in .env are listed and attaches every listed text as an observed-outcome annotation for the owner to compare.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO lists the available repositories in the Destination dropdown', { tag: '@NJM-154784' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  const primary = readBackupRepo('PRIMARY');
  const secondary = readBackupRepo('SECONDARY');

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the database and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. Click the destination dropdown: the list is displayed', async () => {
    await dest.openList();
    await expect(dest.listSearch).toBeVisible();
  });
  await test.step('4. Compare the listed repositories with the configured ones: the named repositories are listed', async () => {
    await expect(dest.text(primary).first()).toBeVisible();
    await expect(dest.text(secondary).first()).toBeVisible();
    const before = await backupFlows.visibleTexts();
    testInfo.annotations.push({ type: 'observed-outcome', description: `Visible texts with the list open (compare with Configuration > Repositories): ${before.join(' ; ')}` });
  });
});
