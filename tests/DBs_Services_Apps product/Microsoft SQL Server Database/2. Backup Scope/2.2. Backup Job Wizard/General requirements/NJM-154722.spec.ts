import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../../flows/bkA2-wizard.flows';

// NJM-154722: "[DBM-BK-UI-General-0001] Verify Wizard Name Generic Title".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (the wizard is opened and cancelled; no job is created).
// case-vs-ui: the cases say "Jobs > Create"; the UI is Data Protection > "+" > Backup for Database. The title is "New Backup Job Wizard for Database".
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO shows the generic title "New Backup Job Wizard for Database" on every step of the database backup wizard', { tag: '@NJM-154722' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: Data Protection is open and the Create menu offers Backup for Database', async () => {
    const entry = await wiz.openCreateMenu();
    await expect(entry).toBeVisible();
    await wiz.closeMenu();
  });

  await test.step('2. Start the Microsoft SQL Server database backup wizard: it opens', async () => {
    await backupFlows.openWizard();
    await expect(backupWizardPage.title).toBeVisible();
    if ((await backupWizardPage.treeCheckbox(item).count()) === 0) throw new Error(`ABORTED: the Inventory item "${item}" is not listed in the wizard's Source tree`);
  });

  await test.step('3. Read the wizard title: it is the generic backup-job title, not an application-specific name', async () => {
    await expect(backupWizardPage.title).toContainText('New Backup Job Wizard for Database');
    await expect(backupWizardPage.title).not.toContainText(/Microsoft|SQL Server/i);
  });

  await test.step('4. Proceed through the first step and re-check the header: the generic title stays', async () => {
    await backupFlows.selectSources([{ item, databases: [db] }]);
    await backupFlows.next();
    await expect(backupWizardPage.title).toContainText('New Backup Job Wizard for Database');
  });

  await test.step('Ad hoc: the generic title is shown on Destination, Schedule and Options as well', async () => {
    await backupFlows.chooseDestination(repo);
    await backupFlows.next();
    await expect(backupWizardPage.title).toContainText('New Backup Job Wizard for Database');
    await backupFlows.next();
    await expect(backupWizardPage.jobNameField).toBeVisible();
    await expect(backupWizardPage.title).toContainText('New Backup Job Wizard for Database');
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Jobs > Create in the case is Data Protection > + > Backup for Database in the UI.' });
  });
});
