import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-154816: "[DBM-BK-UI-Dest-0017-1] Verify Target Destination Dropdown".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved (the browser page of the test is discarded with it); no job, Inventory item or repository is touched.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case says "Fast Setup" / "Advanced Setup": the UI has the "Destination:" combo above an "Advanced setup..." link that lists one block per ticked item and one row per database ("Click to expand").
// case-vs-ui: the case speaks of a "container" and of "standalone" databases; the UI shows a block per ticked item (all its databases ticked) and a single ticked database as its own block (inferred from the notes, not seen live).
test.use(RUN_OPTIONS);

test('NAKIVO shows a per-database Target destination dropdown in each database block', { tag: '@NJM-154816' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case says \"Fast Setup\" / \"Advanced Setup\": the UI has the \"Destination:\" combo above an \"Advanced setup...\" link that lists one block per ticked item and one row per database (\"Click to expand\"). | the case speaks of a \"container\" and of \"standalone\" databases; the UI shows a block per ticked item (all its databases ticked) and a single ticked database as its own block (inferred from the notes, not seen live)." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const db2 = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  await test.step('1. Open Data Protection, click + and choose Backup for Database: the New Backup Job Wizard for Database opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
    await expect(backupFlows.wizard.selectionSummary).toContainText('Select at least one item');
  });
  await test.step('2. Select the whole item (all its databases) and click Next: the wizard advances to Step 2 (Destination)', async () => {
    await backupFlows.selectSources([{ item: source.item }]);
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
    await expect(dest.p.topCombo).toBeVisible();
  });
  await test.step('3. In Advanced setup expand a database block: a target destination dropdown is present for that database', async () => {
    await dest.openAdvancedSetup();
    await dest.expand(db1);
    await expect(dest.p.dbCombo(db1)).toBeVisible();
  });
  await test.step('4. Confirm the dropdown is per database: it changes only that database', async () => {
    await dest.ensureExpanded(db2);
    await expect(dest.p.dbCombo(db2)).toBeVisible();
    const otherBefore = await dest.databaseDestinationValue(db2);
    await dest.setDatabaseDestination(db1, repo);
    expect(await dest.databaseDestinationValue(db1)).toContain(repo);
    expect(await dest.databaseDestinationValue(db2)).toBe(otherBefore);
  });
});
