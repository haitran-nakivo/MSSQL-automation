import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../../flows/bkA2-wizard.flows';

// NJM-154725: "[DBM-BK-UI-General-0004] Verify Common Wizard Behaviors" (Next / Back / Cancel).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none intended; the job name NJM-154725 is typed on the last step and the wizard is cancelled (afterEach deletes a job of that name if one slipped through).
// case-vs-ui: the case says "Databases" for the first step; the UI calls it Source. "Back" is UNVERIFIED: the notes list no Back button, so when none exists the
//   step tab of the previous step is used and an annotation says so. Whether Cancel asks "Close the wizard?" is UNVERIFIED for this wizard.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154725');

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen();
    await backupFlows.discardJobIfPresent(JOB);
  } catch { /* best effort */ }
});

test('NAKIVO database backup wizard blocks Next without a source, moves with Next / Back and closes without creating a job on Cancel', { tag: '@NJM-154725' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the Inventory item is offered by the wizard', async () => {
    await backupFlows.openWizard();
    if ((await backupWizardPage.treeCheckbox(db).count()) === 0) throw new Error(`ABORTED: database "${db}" of "${item}" is not listed in the wizard's Source tree`);
  });

  await test.step('2. Open the wizard: it is on the first step (Source)', async () => {
    await expect(backupWizardPage.title).toBeVisible();
    expect(await wiz.onSourceStep()).toBe(true);
    expect(await wiz.sourceSummaryText()).toContain('Select at least one item on the left');
  });

  await test.step('3. Click Next without a selection: navigation is blocked and the wizard stays on Source', async () => {
    await backupFlows.next({ blocked: true });
    expect(await wiz.onSourceStep()).toBe(true);
    expect(await wiz.onDestinationStep()).toBe(false);
    expect(await wiz.sourceSummaryText()).toContain('Select at least one item on the left');
  });

  await test.step('4. Select a database, click Next (Destination opens), then go back (Source with the selection kept)', async () => {
    await backupFlows.selectSources([{ item, databases: [db] }]);
    await backupFlows.next();
    expect(await wiz.onDestinationStep()).toBe(true);
    if ((await wiz.backButton.count()) > 0) {
      await wiz.backButton.click({ timeout: 10_000 });
    } else {
      await backupFlows.goToStep('Source');
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'No Back button was found; the Source step tab was used to go back.' });
    }
    expect(await wiz.onSourceStep()).toBe(true);
    expect(await wiz.sourceSummaryText()).not.toContain('Select at least one item on the left');
  });

  await test.step('5. Click Cancel and confirm any prompt: the wizard closes and no job is created', async () => {
    await backupFlows.next();
    await backupFlows.chooseDestination(repo);
    await backupFlows.next();
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await wiz.cancelAndConfirm();
    expect(await wiz.wizardIsOpen()).toBe(false);
    expect(await backupFlows.jobExists(JOB)).toBe(false);
  });
});
