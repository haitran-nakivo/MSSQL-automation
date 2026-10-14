import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../../helpers/backup-env';
import { WIZARD_STEPS, WizardUiFlows } from '../../../../../../flows/bkA2-wizard.flows';

// NJM-154724: "[DBM-BK-UI-General-0003] Verify Wizard Steps (Fusion/Retention Schedule)".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (the wizard is walked to its last step and cancelled; no job is created).
// case-vs-ui: Director 11.2.1 has no "Fusion" model setting and no separate Retention step. Retention is inline in Schedule as "Keep backups for";
//   the wizard has 4 steps (Source, Destination, Schedule, Options).
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO database backup wizard has no separate Retention step: retention is inline in Schedule and every step is reachable', { tag: '@NJM-154724' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the Inventory item and its database are offered by the wizard', async () => {
    await backupFlows.openWizard();
    if ((await backupWizardPage.treeCheckbox(db).count()) === 0) throw new Error(`ABORTED: database "${db}" of "${item}" is not listed in the wizard's Source tree`);
  });

  await test.step('2. Open the wizard: no Fusion switch exists, the wizard opens on Source', async () => {
    await expect(backupWizardPage.selectionSummary).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'No Fusion (Schedule + Retention) model setting exists in 11.2.1.' });
  });

  await test.step('3. Read the step bar: Source, Destination, Schedule, Options; there is no Retention step (case expects one)', async () => {
    expect(await wiz.visibleStepNames()).toEqual(WIZARD_STEPS);
    expect(await wiz.textVisible('Retention')).toBe(false);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Case expects a dedicated Retention step; the UI keeps retention inline in Schedule ("Keep backups for").' });
  });

  await test.step('4. Click Next through each step: Schedule carries the retention control, the last step allows Finish', async () => {
    await backupFlows.selectSources([{ item, databases: [db] }]);
    await backupFlows.next();
    await backupFlows.chooseDestination(repo);
    await backupFlows.next();
    expect(await wiz.onScheduleStep()).toBe(true);
    expect(await wiz.textVisible('Keep backups for', false)).toBe(true);
    await backupFlows.next();
    await expect(backupWizardPage.jobNameField).toBeVisible();
    await expect(backupWizardPage.finishButton).toBeVisible();
  });

  await test.step('Ad hoc: Do not schedule, run on demand hides the retention control', async () => {
    await backupFlows.goToStep('Schedule');
    await backupFlows.setOnDemand();
    await expect(page.getByText('Keep backups for', { exact: false }).filter({ visible: true })).toHaveCount(0);
  });
});
