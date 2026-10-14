import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../../flows/bkA2-wizard.flows';

// NJM-154727: "[DBM-BK-UI-General-0006] Verify Configuration Persistence on Navigation".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (the wizard is cancelled; no job is created).
// case-vs-ui: "Databases" step = Source step. Step 5 "change a value": the on-demand checkbox of Schedule is changed (the UI shows "Keep backups for" only while
//   a schedule is configured), then Destination is visited and Schedule re-opened.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO database backup wizard keeps the chosen database, destination and schedule values when the user moves between steps', { tag: '@NJM-154727' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the Inventory item is offered by the wizard', async () => {
    await backupFlows.openWizard();
    if ((await backupWizardPage.treeCheckbox(db).count()) === 0) throw new Error(`ABORTED: database "${db}" of "${item}" is not listed in the wizard's Source tree`);
  });

  await test.step('2. Select a database on the Source step: it is selected', async () => {
    await backupFlows.selectSources([{ item, databases: [db] }]);
    expect(await wiz.sourceSummaryText()).not.toContain('Select at least one item on the left');
    await expect(page.getByText(db, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  await test.step('3. Advance to Destination, choose a repository, advance to Schedule', async () => {
    await backupFlows.next();
    await backupFlows.chooseDestination(repo);
    await expect(backupWizardPage.destinationCombo).toHaveValue(new RegExp(repo));
    await backupFlows.next();
    expect(await wiz.onScheduleStep()).toBe(true);
  });

  await test.step('4. Go back to Source and forward to Destination: the database and the repository are still set', async () => {
    await backupFlows.goToStep('Source');
    expect(await wiz.sourceSummaryText()).not.toContain('Select at least one item on the left');
    await expect(page.getByText(db, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await backupFlows.goToStep('Destination');
    await expect(backupWizardPage.destinationCombo).toHaveValue(new RegExp(repo));
  });

  await test.step('5. Change a value on Schedule (run on demand), leave and come back: the change is kept', async () => {
    await backupFlows.goToStep('Schedule');
    expect(await wiz.textVisible('Keep backups for', false)).toBe(true);
    await backupFlows.setOnDemand();
    expect(await wiz.textVisible('Keep backups for', false)).toBe(false);
    await backupFlows.goToStep('Destination');
    await backupFlows.goToStep('Schedule');
    expect(await wiz.textVisible('Keep backups for', false)).toBe(false);
    await backupFlows.goToStep('Source');
    await backupFlows.goToStep('Schedule');
    expect(await wiz.textVisible('Keep backups for', false)).toBe(false);
  });
});
