import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154789: "[DBM-BK-UI-Dest-0003-2] Verify Link Hides After Click".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The link is "Advanced setup..." (the banner sentence "...expand the Advanced setup..." is a different text).
// The "link hides after the click" expectation comes only from the case; it was not recorded in the exploration notes (outcome attached for the owner).
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO hides the Advanced setup link after it is clicked', { tag: '@NJM-154789' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the database and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
    await expect(dest.advancedLink).toBeVisible();
  });
  await test.step('3. Click the Advanced setup link: the view switches to Advanced setup', async () => {
    await dest.openAdvanced();
    await expect(dest.header(db)).toBeVisible();
  });
  await test.step('4. Look for the link after the switch: it is no longer displayed', async () => {
    testInfo.annotations.push({ type: 'observed-outcome', description: `Advanced setup link count after the switch: ${await dest.advancedLink.count()}` });
    await expect(dest.advancedLink).toHaveCount(0);
  });
});
