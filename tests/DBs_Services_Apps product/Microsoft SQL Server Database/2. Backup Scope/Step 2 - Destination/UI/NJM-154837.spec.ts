import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5DestinationFlows } from '../../../../../../flows/bkA5-destination.flows';

// NJM-154837: "[DBM-BK-UI-Dest-0020] Verify New Item Addition (No Repo)".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_INSTANCE_DB_FULL (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved (the browser page of the test is discarded with it); no job, Inventory item or repository is touched.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case expects a "missing-target warning" on the new database; none is recorded in the UI notes (Observed: Next with no destination chosen stays silently on Step 2, no invalid mark). The spec asserts no repository is assigned and that Next is blocked, and attaches every text it sees.
test.use(RUN_OPTIONS);

test('NAKIVO shows a database added in Step 1 without a repository when none was chosen in Step 2', { tag: '@NJM-154837' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const dest = new BkA5DestinationFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case expects a \"missing-target warning\" on the new database; none is recorded in the UI notes (Observed: Next with no destination chosen stays silently on Step 2, no invalid mark). The spec asserts no repository is assigned and that Next is blocked, and attaches every text it sees." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const db2 = readBackupDatabase('INSTANCE', 'FULL');
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
  await test.step('3. Return to Step 1, add another database and go back to Step 2: the new database appears with no repository assigned', async () => {
    const top = await dest.topDestinationValue();
    if (top !== '' && !top.includes('Select a target destination')) throw new Error('ABORTED: the Destination combo already shows "' + top + '" (a single repository or a default); the case needs no pre-selected destination');
    await dest.goToSource();
    await dest.toggleDatabase(source.item, db2);
    await dest.goToDestination();
    await dest.openAdvancedSetup();
    await dest.ensureExpanded(db2);
    await expect(dest.p.dbName(db2)).toBeVisible();
    const value = await dest.databaseDestinationValue(db2);
    expect(value === '' || value.includes('Select a target destination'), 'the new database already has a repository: ' + value).toBe(true);
  });
  await test.step('4. Confirm the missing target: Next is blocked until a repository is assigned', async () => {
    await backupFlows.next();
    await expect(backupFlows.wizard.advancedSetupLink).toBeVisible();
    testInfo.annotations.push({ type: 'observed-outcome', description: 'texts on the Destination step: ' + JSON.stringify((await backupFlows.visibleTexts()).filter((text) => /target|select|missing|required/i.test(text))) });
  });
});
