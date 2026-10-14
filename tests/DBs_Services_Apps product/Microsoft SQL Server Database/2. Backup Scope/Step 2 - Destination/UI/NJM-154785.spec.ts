import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154785: "[DBM-BK-UI-Dest-0002-6] Verify Stream Repository Support".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (any stream repository) (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI).
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO lists a stream repository as a destination and accepts it', { tag: '@NJM-154785' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  const stream = readBackupRepo('PRIMARY');

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the database and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. Open the dropdown: the stream repository is listed and enabled', async () => {
    await dest.openList();
    const option = backupFlows.wizard.destinationOption(stream);
    await expect(option).toBeVisible();
    expect(await backupFlows.isDisabled(option), 'the stream repository is shown as disabled').toBe(false);
  });
  await test.step('4. Select the stream repository: it is accepted and shown as the destination', async () => {
    await dest.pickRepository(stream);
    await expect(dest.fastCombo).toHaveValue(new RegExp(stream.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(dest.text('Different backup repositories selected')).toHaveCount(0);
  });
});
