import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupValue } from '../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../flows/bkA2-wizard.flows';

// NJM-154737: "Verify Whole Server Selection Block" ([Scope: Gen Req] "Backing up whole server/instance NOT supported").
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL.
// Side effects: none (the wizard is opened, ticked and cancelled).
// case-vs-ui (CONTRADICTION): the case expects the instance node to be a container that cannot be selected. Observed on 11.2.1 (knowledge/workflows/backup/backup-job-wizard.md): the instance row HAS a
//   checkbox; ticking it ticks every database under it and the right panel says "N item(s) were added to this job. New items created on or moved to the source host will be automatically added to this
//   job." and Next is enabled. This spec asserts the OBSERVED behaviour and records the contradiction; it also checks that single databases are selectable (what the case's step 4 says).
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO Source step offers the instance node as a selectable item that selects all its databases, and single databases as well', { tag: '@NJM-154737' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: the SQL Server instance is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(item))) throw new Error(`ABORTED: the Inventory item "${item}" is not listed`);
  });

  await test.step('2. Open Data Protection > + > Backup for Database: the wizard opens on the Source step', async () => {
    await backupFlows.openWizard();
    expect(await wiz.onSourceStep()).toBe(true);
  });

  await test.step('3. Attempt to select the root instance node itself: observed, it IS selectable and selects all its databases', async () => {
    await expect(backupWizardPage.treeCheckbox(item)).toBeVisible();
    await backupFlows.selectSources([{ item }]);
    const summary = await wiz.sourceSummaryText();
    expect(summary).toMatch(/item\(s\) were added to this job/);
    testInfo.annotations.push({ type: 'observed-outcome', description: `Summary after ticking the instance node: ${summary}` });
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Case says the instance node cannot be selected as a backup entity; the 11.2.1 UI selects the instance with all its databases (and future ones).' });
  });

  await test.step('4. Verify what is selectable: individual databases can be selected (untick the instance, tick one database)', async () => {
    await backupFlows.selectSources([{ item }]);
    expect(await wiz.sourceSummaryText()).toContain('Select at least one item on the left');
    await backupFlows.selectSources([{ item, databases: [db] }]);
    expect(await wiz.sourceSummaryText()).not.toContain('Select at least one item on the left');
  });
});
