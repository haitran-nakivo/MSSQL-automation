import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154793: "[DBM-BK-UI-Dest-0007] Verify Item Order Matches Source".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_INSTANCE_DB_FULL (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI).
// The order on Step 1 is read from the right pane (the later match of each name on the page, top to bottom) before Next; Advanced setup must repeat it.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO lists the Advanced setup items in the order shown on the Source step', { tag: '@NJM-154793' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const selected = [readBackupDatabase('INSTANCE', 'SIMPLE'), readBackupDatabase('INSTANCE', 'FULL')];
  let step1Order: string[] = [];

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick two databases, note their order on Step 1 and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: selected }]);
    step1Order = await dest.verticalOrder(selected, 'last');
    expect(step1Order).toHaveLength(selected.length);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. Open Advanced setup and compare the item order with Step 1: the order is the same', async () => {
    await dest.openAdvanced();
    expect(await dest.verticalOrder(selected)).toEqual(step1Order);
  });
  await test.step('4. Confirm the top and bottom items: the first and last match those of Step 1', async () => {
    const order = await dest.verticalOrder(selected);
    expect(order[0]).toBe(step1Order[0]);
    expect(order[order.length - 1]).toBe(step1Order[step1Order.length - 1]);
  });
});
