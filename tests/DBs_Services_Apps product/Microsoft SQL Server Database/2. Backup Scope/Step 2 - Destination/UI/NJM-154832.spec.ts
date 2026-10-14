import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-154832: "[DBM-BK-UI-Dest-0017-3-8] Verify Cross-Hypervisor Tooltip".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_OTHER_HV_BACKUP, NAKIVO_BK_OTHER_BACKUP_REPO (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved (the browser page of the test is discarded with it); no job, Inventory item or repository is touched.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Fast Setup" / "Advanced Setup": the UI has the "Destination:" combo above an "Advanced setup..." link that lists one block per ticked item and one row per database ("Click to expand").
// case-vs-ui: the case calls the control "Use existing backup" with a "Target backup" dropdown; the UI label is "Use an existing backup as a target" and the combo shows "Select a backup".
// case-vs-ui: the case title quotes "Cross-hypervisor jobs not supported"; the spec checks the tooltip mentions cross-hypervisor and "not supported".
// UNVERIFIED: how the Director marks a disabled list entry (class x-item-disabled / aria-disabled) and which pop-up text a cross-platform backup shows were never seen: the product behaviour listed in the case is asserted as written.
test.use(RUN_OPTIONS);

test('NAKIVO explains with a tooltip that cross-hypervisor backups cannot be used as the target', { tag: '@NJM-154832' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Fast Setup\" / \"Advanced Setup\": the UI has the \"Destination:\" combo above an \"Advanced setup...\" link that lists one block per ticked item and one row per database (\"Click to expand\"). | the case calls the control \"Use existing backup\" with a \"Target backup\" dropdown; the UI label is \"Use an existing backup as a target\" and the combo shows \"Select a backup\". | the case title quotes \"Cross-hypervisor jobs not supported\"; the spec checks the tooltip mentions cross-hypervisor and \"not supported\"." });
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
  await test.step('3. Hover over the disabled backup of a different hypervisor/platform: a tooltip explains it cannot be used', async () => {
    await dest.openAdvancedSetup();
    await dest.setDatabaseDestination(db1, otherRepo);
    await dest.tickUseExisting(db1);
    const listed = await dest.openBackupList(db1);
    expect(listed.join(' '), 'the other backup is not listed in the repository').toContain(otherBackup);
    const texts = await backupFlows.hoverTexts(dest.p.backupEntry(otherBackup));
    testInfo.annotations.push({ type: 'observed-outcome', description: 'hover text: ' + JSON.stringify(texts) });
    expect(texts.join(' ')).toMatch(/cross-hypervisor/i);
  });
  await test.step('4. Read the tooltip text: it states that cross-hypervisor jobs are not supported', async () => {
    const texts = await backupFlows.hoverTexts(dest.p.backupEntry(otherBackup));
    expect(texts.join(' ')).toMatch(/not supported/i);
  });
});
