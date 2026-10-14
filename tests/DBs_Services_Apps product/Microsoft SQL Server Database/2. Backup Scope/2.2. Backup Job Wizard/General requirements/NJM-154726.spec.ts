import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../../flows/bkA2-wizard.flows';

// NJM-154726: "[DBM-BK-UI-General-0005] Verify Quick Navigation via Step Name".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (the wizard is cancelled; no job is created).
// case-vs-ui: "Databases" in the case is the Source step in the UI. Step 4 of the case (unreachable steps are disabled) is checked as: on a fresh wizard the
//   Options tab does not move the wizard (UNVERIFIED: the notes say the tabs are clickable "once a step was reached", i.e. an unreached tab is expected to do nothing).
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO database backup wizard lets the user jump back to a visited step by its name and not forward to an unvisited one', { tag: '@NJM-154726' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the Inventory item is offered by the wizard', async () => {
    await backupFlows.openWizard();
    if ((await backupWizardPage.treeCheckbox(db).count()) === 0) throw new Error(`ABORTED: database "${db}" of "${item}" is not listed in the wizard's Source tree`);
  });

  await test.step('Ad hoc (negative): on a fresh wizard a click on the Options step name does not move the wizard', async () => {
    await backupFlows.selectSources([{ item, databases: [db] }]);
    await backupFlows.goToStep('Options');
    expect(await wiz.onOptionsStep()).toBe(false);
    expect(await wiz.onSourceStep()).toBe(true);
  });

  await test.step('2. Advance a few steps forward: the wizard is on Schedule with Source and Destination done', async () => {
    await backupFlows.next();
    await backupFlows.chooseDestination(repo);
    await backupFlows.next();
    expect(await wiz.onScheduleStep()).toBe(true);
  });

  await test.step('3. Click the visited step name Destination: the wizard jumps straight to it', async () => {
    await backupFlows.goToStep('Destination');
    expect(await wiz.onDestinationStep()).toBe(true);
    expect(await wiz.onScheduleStep()).toBe(false);
  });

  await test.step('3b. Click the visited step name Source: the wizard jumps straight to it', async () => {
    await backupFlows.goToStep('Source');
    expect(await wiz.onSourceStep()).toBe(true);
  });

  await test.step('4. A step not visited yet (Options) cannot be jumped to', async () => {
    await backupFlows.goToStep('Options');
    expect(await wiz.onOptionsStep()).toBe(false);
  });
});
