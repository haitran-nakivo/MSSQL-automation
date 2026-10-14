import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-171431: "Backup - Step 2 - Destination: Use an existing backup as a target - select RP from other backup type".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_OTHER_HV_BACKUP, NAKIVO_BK_OTHER_BACKUP_REPO (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Use an existing backup as a target" on Step 2 - Destination; in the UI it is the checkbox of the database block in "Advanced setup" with the "Select a backup" combo (it lists every backup of the chosen repository: backup name / job name).
// case-vs-ui: the case expects the error "Cross-hypervisor are not supported" when a non-SQL recovery point is chosen; whether the Director greys the entry, shows a tooltip or a pop-up was never observed: the spec collects hover and click texts and asserts the message and that nothing is mapped.
// UNVERIFIED: how an entry of another backup type looks in the list and where the "Cross-hypervisor" message is shown.
test.use(RUN_OPTIONS);

test('NAKIVO does not let a backup of another backup type be used as the target of a database backup job', { tag: '@NJM-171431' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Use an existing backup as a target\" on Step 2 - Destination; in the UI it is the checkbox of the database block in \"Advanced setup\" with the \"Select a backup\" combo (it lists every backup of the chosen repository: backup name / job name). | the case expects the error \"Cross-hypervisor are not supported\" when a non-SQL recovery point is chosen; whether the Director greys the entry, shows a tooltip or a pop-up was never observed: the spec collects hover and click texts and asserts the message and that nothing is mapped." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const otherRepo = readBackupValue('OTHER_BACKUP_REPO');
  const otherBackup = readBackupValue('OTHER_HV_BACKUP');
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
  await test.step('3. Choose "Use an existing backup as a target" in the repository that holds a backup of another type: the existing-backup selection is shown', async () => {
    await dest.openAdvancedSetup();
    await dest.setDatabaseDestination(db1, otherRepo);
    await dest.tickUseExisting(db1);
    const listed = await dest.openBackupList(db1);
    expect(listed.join(' '), 'the other-type backup is not listed in the repository').toContain(otherBackup);
  });
  await test.step('4. Attempt to select the recovery point of the other backup type: the cross-hypervisor message is shown and nothing is mapped', async () => {
    const hover = await backupFlows.hoverTexts(dest.p.backupEntry(otherBackup));
    const click = await dest.newTextsAfter(() => dest.p.backupEntry(otherBackup).click({ force: true, timeout: 10_000 }));
    const message = hover.concat(click).join(' ');
    testInfo.annotations.push({ type: 'observed-outcome', description: 'hover and click texts: ' + message });
    expect(message).toMatch(/cross-hypervisor/i);
    expect(await dest.backupComboValue(db1), 'the other-type backup was mapped as a target').toBe('');
    await expect(dest.p.confirmDialog).toBeHidden();
  });
});
