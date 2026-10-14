import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-154823: "[DBM-BK-UI-Dest-0017-2-2] Verify Checkbox Disabled State".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_EMPTY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved (the browser page of the test is discarded with it); no job, Inventory item or repository is touched.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Fast Setup" / "Advanced Setup": the UI has the "Destination:" combo above an "Advanced setup..." link that lists one block per ticked item and one row per database ("Click to expand").
// case-vs-ui: the case calls the control "Use existing backup" with a "Target backup" dropdown; the UI label is "Use an existing backup as a target" and the combo shows "Select a backup".
// case-vs-ui: the case text contradicts itself (title: disabled while no Target Destination is selected; step 3: disabled when the repository has no backup); both are checked: "Select a backup" is disabled with no destination, and an empty repository offers nothing to map.
// UNVERIFIED: whether the checkbox itself is disabled (not only the "Select a backup" combo) is not recorded in the notes; the assertion accepts "disabled" or "nothing in the list".
test.use(RUN_OPTIONS);

test('NAKIVO does not let the user map an existing backup when the destination has none (checkbox state)', { tag: '@NJM-154823' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Fast Setup\" / \"Advanced Setup\": the UI has the \"Destination:\" combo above an \"Advanced setup...\" link that lists one block per ticked item and one row per database (\"Click to expand\"). | the case calls the control \"Use existing backup\" with a \"Target backup\" dropdown; the UI label is \"Use an existing backup as a target\" and the combo shows \"Select a backup\". | the case text contradicts itself (title: disabled while no Target Destination is selected; step 3: disabled when the repository has no backup); both are checked: \"Select a backup\" is disabled with no destination, and an empty repository offers nothing to map." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const emptyRepo = readBackupValue('REPO_EMPTY');
  await test.step('1. Open Data Protection, click + and choose Backup for Database: the New Backup Job Wizard for Database opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
    await expect(backupFlows.wizard.selectionSummary).toContainText('Select at least one item');
  });
  await test.step('2. Select one database and click Next: the wizard advances to Step 2 (Destination)', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
    await expect(dest.p.topCombo).toBeVisible();
  });
  await test.step('3. Select a repository that holds no backup, then try the existing-backup control: no backup can be mapped', async () => {
    await dest.openAdvancedSetup();
    await dest.ensureExpanded(db1);
    const before = await dest.backupComboState(db1);
    const top = await dest.topDestinationValue();
    if (top === '' || top.includes('Select a target destination')) {
      expect(before.disabled, 'the "Select a backup" combo is enabled although no destination is chosen').toBe(true);
    } else {
      testInfo.annotations.push({ type: 'observed-outcome', description: 'A default destination was pre-selected (' + top + '), so the disabled state before choosing a destination could not be checked' });
    }
    await dest.setDatabaseDestination(db1, emptyRepo);
    const state = await dest.useExistingState(db1);
    let listed = 0;
    if (!state.disabled) {
      await dest.tickUseExisting(db1);
      listed = (await dest.openBackupList(db1)).length;
    }
    testInfo.annotations.push({ type: 'observed-outcome', description: 'checkbox disabled=' + state.disabled + ', backups offered=' + listed });
    expect(state.disabled || listed === 0, 'an empty repository still offers existing backups').toBe(true);
  });
  await test.step('4. Hover the checkbox / its info icon: the text shown is recorded', async () => {
    const texts = await backupFlows.hoverTexts(dest.p.useExistingFor(db1));
    testInfo.annotations.push({ type: 'observed-outcome', description: 'hover text: ' + JSON.stringify(texts) });
  });
});
