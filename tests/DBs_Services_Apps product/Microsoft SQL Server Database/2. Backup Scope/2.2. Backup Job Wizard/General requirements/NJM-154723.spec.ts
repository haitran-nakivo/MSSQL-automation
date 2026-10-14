import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../../helpers/backup-env';
import { WIZARD_STEPS, WizardUiFlows } from '../../../../../../flows/bkA2-wizard.flows';

// NJM-154723: "[DBM-BK-UI-General-0002] Verify Wizard Steps (Legacy Schedule)".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (the wizard is walked to its last step and cancelled; no job is created).
// case-vs-ui: Director 11.2.1 has no "Legacy Schedule" / "Fusion" model setting. The wizard always has 4 steps (Source, Destination, Schedule,
//   Options); the case lists Actions and Data Transfer as steps, which the UI does not have (their controls are inside Schedule and Options).
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO database backup wizard exposes its step set and lets the user go through every step to Finish', { tag: '@NJM-154723' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the Inventory item and its database are offered by the wizard', async () => {
    await backupFlows.openWizard();
    if ((await backupWizardPage.treeCheckbox(db).count()) === 0) throw new Error(`ABORTED: database "${db}" of "${item}" is not listed in the wizard's Source tree`);
  });

  await test.step('2. Open the wizard: there is no schedule-model switch, the wizard opens on Source (case: "Legacy Schedule")', async () => {
    await expect(backupWizardPage.title).toBeVisible();
    await expect(backupWizardPage.selectionSummary).toBeVisible();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'No Legacy / Fusion schedule model setting exists in 11.2.1; the single 4-step wizard is checked.' });
  });

  await test.step('3. Read the step bar: Source, Destination, Schedule, Options are shown, and no separate Actions or Data Transfer step', async () => {
    expect(await wiz.visibleStepNames()).toEqual(WIZARD_STEPS);
    expect(await wiz.textVisible('Actions')).toBe(false);
    expect(await wiz.textVisible('Data Transfer')).toBe(false);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Case expects Actions and Data Transfer steps (6 steps); the UI has 4.' });
  });

  await test.step('4. Click Next through each step to the last step: every step is reachable in order and the last allows Finish', async () => {
    await backupFlows.selectSources([{ item, databases: [db] }]);
    await backupFlows.next();
    await expect(backupWizardPage.destinationCombo).toBeVisible();
    await backupFlows.chooseDestination(repo);
    await backupFlows.next();
    expect(await wiz.onScheduleStep()).toBe(true);
    await backupFlows.next();
    await expect(backupWizardPage.jobNameField).toBeVisible();
    await expect(backupWizardPage.finishButton).toBeVisible();
    await expect(backupWizardPage.finishAndRunButton).toBeVisible();
  });

  await test.step('Ad hoc (negative): the last step has no Next button', async () => {
    await expect(backupWizardPage.nextButton).toHaveCount(0);
  });
});
