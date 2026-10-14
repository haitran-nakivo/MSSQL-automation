import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';
import { USE_EXISTING_TEXT } from '../../../../../../pages/bkA5-destination.page';

// NJM-154821: "[DBM-BK-UI-Dest-0017-2] Verify 'Use existing backup' Checkbox".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved (the browser page of the test is discarded with it); no job, Inventory item or repository is touched.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Fast Setup" / "Advanced Setup": the UI has the "Destination:" combo above an "Advanced setup..." link that lists one block per ticked item and one row per database ("Click to expand").
// case-vs-ui: the case calls the control "Use existing backup" with a "Target backup" dropdown; the UI label is "Use an existing backup as a target" and the combo shows "Select a backup".
test.use(RUN_OPTIONS);

test('NAKIVO shows the \'Use an existing backup as a target\' checkbox in a database block', { tag: '@NJM-154821' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Fast Setup\" / \"Advanced Setup\": the UI has the \"Destination:\" combo above an \"Advanced setup...\" link that lists one block per ticked item and one row per database (\"Click to expand\"). | the case calls the control \"Use existing backup\" with a \"Target backup\" dropdown; the UI label is \"Use an existing backup as a target\" and the combo shows \"Select a backup\"." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
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
  await test.step('3. In Advanced setup expand a database block: a checkbox for using an existing backup is displayed', async () => {
    await dest.openAdvancedSetup();
    await dest.ensureExpanded(db1);
    await expect(dest.p.useExistingFor(db1)).toBeVisible();
  });
  await test.step('4. Confirm the checkbox label', async () => {
    await expect(dest.p.useExistingFor(db1)).toHaveText(USE_EXISTING_TEXT);
  });
});
