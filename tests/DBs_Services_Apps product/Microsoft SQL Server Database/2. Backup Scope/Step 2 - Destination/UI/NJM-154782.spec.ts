import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154782: "[DBM-BK-UI-Dest-0002-3] Verify Search Behavior Standard".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The "common Search spec" is not in the case; only filtering and restoring the list are checked.
// The typed substring is the shortest prefix of the PRIMARY name that the SECONDARY name does not contain, so filtering is observable.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO filters the Destination dropdown by the typed text and restores the list when it is cleared', { tag: '@NJM-154782' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  const primary = readBackupRepo('PRIMARY');
  const secondary = readBackupRepo('SECONDARY');
  let prefix = '';
  for (let length = 1; length <= primary.length; length++) {
    if (!secondary.toLowerCase().includes(primary.slice(0, length).toLowerCase())) {
      prefix = primary.slice(0, length);
      break;
    }
  }
  if (!prefix) throw new Error('ABORTED: the PRIMARY repository name contains no text that the SECONDARY name lacks; use two differently named repositories');

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the database and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. Open the dropdown and type part of a repository name: the list filters to matching entries', async () => {
    await dest.openList();
    await expect(dest.text(primary).first()).toBeVisible();
    await expect(dest.text(secondary).first()).toBeVisible();
    await dest.searchList(prefix);
    await expect(dest.text(primary).first()).toBeVisible();
    await expect(dest.text(secondary), 'an entry that does not match the typed text is still listed').toHaveCount(0, { timeout: 10_000 });
  });
  await test.step('4. Clear the search text: the full repository list is shown again', async () => {
    await dest.clearListSearch();
    await expect(dest.text(primary).first()).toBeVisible();
    await expect(dest.text(secondary).first()).toBeVisible();
  });
});
