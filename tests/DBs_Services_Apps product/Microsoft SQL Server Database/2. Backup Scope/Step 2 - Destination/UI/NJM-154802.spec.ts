import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154802: "[DBM-BK-UI-Dest-0015-1] Verify 'No Items Available' Text".
// Env (.env, owner-supplied): NAKIVO_BK_EMPTY_CONTAINER_ITEM = display name of an EXISTING Inventory item that has no databases to back up (a container with
//   no children); not defined in helpers/backup-env, read with readBackupValue. ENV-GATED: without it the case ends ABORTED.
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The case does not say how to get a container without selectable items; an item with no databases is
//   the only way the UI offers (unticking every child unticks the item). Whether such an item can be ticked and passed on is not recorded: when it cannot, an
//   observed-outcome annotation says so and the Step 2 expectation fails.
// UNVERIFIED: the text "No items available" (case spelling, matched case-insensitively) was never seen live.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO shows "No items available" for a container block without selectable items in Advanced setup', { tag: '@NJM-154802' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const emptyItem = readBackupValue('EMPTY_CONTAINER_ITEM');

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the item without databases and click Next: the wizard advances to Destination', async () => {
    if ((await backupFlows.wizard.treeRow(emptyItem).count()) === 0) throw new Error(`ABORTED: the item "${emptyItem}" is not in the Source tree (NAKIVO_BK_EMPTY_CONTAINER_ITEM)`);
    await backupFlows.selectSources([{ item: emptyItem }]);
    await backupFlows.next();
    const reached = await dest.fastCombo.isVisible().catch(() => false);
    testInfo.annotations.push({ type: 'observed-outcome', description: `Step 2 reached with an item without databases: ${reached}` });
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. Open Advanced setup for the container block: it shows the "No items available" text', async () => {
    await dest.openAdvanced();
    if ((await dest.text(/No items available/i).count()) === 0) await dest.toggle(emptyItem);
    await expect(dest.text(/No items available/i).first()).toBeVisible();
  });
  await test.step('4. Confirm no destination rows are shown for the empty container', async () => {
    expect(await dest.expandedHintCount()).toBe(0);
  });
});
