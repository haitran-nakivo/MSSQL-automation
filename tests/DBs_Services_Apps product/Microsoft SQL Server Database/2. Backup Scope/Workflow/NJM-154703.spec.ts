import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../flows/bkA2-wizard.flows';

// NJM-154703: "[MSSQL-BK-WF-0004] Verify Options Step".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (the wizard is walked to Options and cancelled).
// case-vs-ui: the case expects "app-aware processing, network encryption and backup encryption". The Options step of 11.2.1 has Job name, Job priority, Network acceleration, Network encryption,
//   Backup encryption, report recipients, pre / post job scripts, "Limit data backup to N concurrent streams" and Bottleneck detection; there is no app-aware processing option for a database job.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO Options step offers the job options: priority, network acceleration / encryption, backup encryption, reports, scripts and data streams', { tag: '@NJM-154703' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the SQL Server instance is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(item))) throw new Error(`ABORTED: the Inventory item "${item}" is not listed`);
  });

  await test.step('2. Start Create > Backup for Database, select the database and the repository (steps Source, Destination)', async () => {
    await backupFlows.openWizard();
    await backupFlows.selectSources([{ item, databases: [db] }]);
    await backupFlows.next();
    await backupFlows.chooseDestination(repo);
    await expect(backupWizardPage.destinationCombo).toHaveValue(new RegExp(repo));
  });

  await test.step('3. Proceed to the Options step: it opens', async () => {
    await backupFlows.next();
    await backupFlows.next();
    expect(await wiz.onOptionsStep()).toBe(true);
  });

  await test.step('4. Review the available options: job name, priority, network acceleration / encryption, backup encryption, reports, scripts, streams', async () => {
    for (const label of ['Job name', 'Job priority', 'Network acceleration', 'Network encryption', 'Backup encryption', 'Send job run reports to', 'Limit data backup to', 'Bottleneck detection']) {
      expect(await wiz.textVisible(label, false), `option "${label}" is not shown`).toBe(true);
    }
    expect(await wiz.textVisible(/pre job script/i, false)).toBe(true);
    expect(await wiz.textVisible(/post job script/i, false)).toBe(true);
    expect(await wiz.textVisible(/app-aware/i, false)).toBe(false);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'No app-aware processing option exists for the database job; the other named options (network encryption, backup encryption) are present.' });
  });
});
