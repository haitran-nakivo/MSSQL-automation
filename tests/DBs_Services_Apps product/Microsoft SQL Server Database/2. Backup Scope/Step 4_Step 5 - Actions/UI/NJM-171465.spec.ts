import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5ActionsFlows } from '../../../../../../flows/bkA5-actions.flows';

// NJM-171465: "[DBM-BK-UI-Actions-0001] Actions Step - UI".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case has a separate "Step 4/Step 5 - Actions" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options.
// case-vs-ui: the approved mockup cannot be compared from a test (attached as not automated); the controls are checked by presence and behaviour.
test.use(RUN_OPTIONS);

test('NAKIVO shows the Actions controls (report e-mail, pre and post job script) on the Options step', { tag: '@NJM-171465' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const actions = new BkA5ActionsFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case has a separate \"Step 4/Step 5 - Actions\" step; in 11.2.1 the wizard has 4 steps and the Actions controls (Send job run reports to, Run local pre/post job script) are on Step 4 Options. | the approved mockup cannot be compared from a test (attached as not automated); the controls are checked by presence and behaviour." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  await test.step('1. Open Data Protection, click + and choose Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });
  await test.step('2. Advance through Source, Destination and Schedule (run on demand) until the Options step, which holds the Actions controls, is displayed', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await backupFlows.chooseDestination(repo);
    await backupFlows.next();
    await backupFlows.setOnDemand();
    await backupFlows.next();
    await expect(backupFlows.wizard.jobNameField).toBeVisible();
    await expect(actions.o.reportLabel()).toBeVisible();
  });
  await test.step('3. Compare the Actions layout with the mockup: the three Actions controls are displayed', async () => {
    testInfo.annotations.push({ type: 'not-automated', description: 'Pixel comparison with the approved mockup is not possible from a test.' });
    await expect(actions.o.reportLabel()).toBeVisible();
    await expect(actions.o.scriptLabel('pre')).toBeVisible();
    await expect(actions.o.scriptLabel('post')).toBeVisible();
  });
  await test.step('4. Inspect the Actions controls: the script checkboxes open their settings and the report recipient field is shown', async () => {
    await expect(actions.o.reportRecipients()).toBeVisible();
    await actions.o.scriptLabel('pre').click({ timeout: 10_000 });
    await expect(actions.o.scriptSettingsLink('pre')).toBeVisible();
    await actions.o.scriptSettingsLink('pre').click({ timeout: 10_000 });
    await expect(actions.o.scriptPathField()).toBeVisible();
  });
});
