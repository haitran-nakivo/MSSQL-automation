import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154787: "[DBM-BK-UI-Dest-0003] Verify 'Advanced Setup' Link".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI).
// case-vs-ui: the link reads "Advanced setup..." (sentence case, trailing dots), the case writes 'Advanced Setup'.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO shows the Advanced setup link on the Fast setup view', { tag: '@NJM-154787' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  testInfo.annotations.push({ type: 'case-vs-ui', description: 'The link reads "Advanced setup..." in the UI; the case says "Advanced Setup".' });
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
  });
  await test.step('3. Locate the mode-switch link: an Advanced setup link is displayed', async () => {
    await expect(dest.advancedLink).toBeVisible();
  });
  await test.step('4. Confirm the wording: the link is labelled Advanced setup', async () => {
    const label = ((await dest.advancedLink.innerText()) ?? '').trim();
    testInfo.annotations.push({ type: 'observed-outcome', description: `Link text: "${label}"` });
    expect(label).toMatch(/^Advanced setup/i);
  });
});
