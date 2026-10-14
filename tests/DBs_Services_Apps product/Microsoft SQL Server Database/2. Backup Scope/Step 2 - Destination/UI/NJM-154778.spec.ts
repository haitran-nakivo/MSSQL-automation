import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154778: "[DBM-BK-UI-Dest-0002] Verify Destination Dropdown Existence".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI); the dropdown is labelled "Destination:" (not "repository").
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO shows a single Destination dropdown on Step 2 of the database backup wizard', { tag: '@NJM-154778' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
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
  });
  await test.step('3. Locate the destination control: one dropdown is present', async () => {
    await expect(dest.fastCombo).toBeVisible();
    await expect(dest.fastCombo).toBeEnabled();
    await expect(dest.text(/^Destination:?$/)).toHaveCount(1);
  });
  await test.step('4. Read the label: it names the destination selector and the dropdown shows a prompt or a repository', async () => {
    await expect(dest.text(/^Destination:?$/)).toBeVisible();
    const shown = (await dest.fastValue()) || (await dest.fastCombo.getAttribute('placeholder')) || '';
    testInfo.annotations.push({ type: 'observed-outcome', description: `Fast setup dropdown shows on open: "${shown}"` });
    expect(shown.length, 'the dropdown shows either "Select a target destination" or the default repository').toBeGreaterThan(0);
  });
});
