import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154795: "[DBM-BK-UI-Dest-0009] Verify Missing Target Warning Icon".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// Precondition: no default destination (two or more repositories exist); with a single repository the wizard pre-selects it and the case cannot be run (ABORTED).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI); the icon id "CI023-1" is not visible in the UI: the warning is detected as an icon-like element
//   that is present on the row before a destination is set and gone after.
// UNVERIFIED: icon detection by markup (img / svg / i / icon- or warn-class elements near the row name).
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO marks an Advanced setup item without a destination with a warning icon until a target is set', { tag: '@NJM-154795' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  let withoutTarget: string[] = [];

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the database and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
    if (await dest.hasDefaultDestination()) throw new Error('ABORTED: the wizard pre-selected a destination (only one repository exists); two repositories are needed');
  });
  await test.step('3. Open Advanced setup with the item left without a destination: it shows a warning icon', async () => {
    await dest.openAdvanced();
    withoutTarget = await dest.iconSignature(db);
    testInfo.annotations.push({ type: 'observed-outcome', description: `Icon-like elements on the item row without a target: ${withoutTarget.join(' ; ') || '(none)'}` });
    expect(withoutTarget.length, 'no icon-like element on the row without a destination').toBeGreaterThan(0);
  });
  await test.step('4. Assign a destination: the warning icon disappears', async () => {
    await dest.setRowDestination(db, repo);
    await expect(dest.rowCombo(db)).toHaveValue(new RegExp(repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const withTarget = await dest.iconSignature(db);
    const gone = withoutTarget.filter((icon) => !withTarget.includes(icon));
    expect(gone.length, 'the icon of the row without a target is still shown after a destination was set').toBeGreaterThan(0);
  });
});
