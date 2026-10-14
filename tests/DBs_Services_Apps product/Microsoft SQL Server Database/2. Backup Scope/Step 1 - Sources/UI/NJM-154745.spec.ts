import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154745: "[DBM-BK-UI-Source-Left Pane-0007] Verify Expand/Collapse Functionality".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE.
// Side effects: none (opens the wizard and cancels it).
// UNVERIFIED: the expand / collapse control ("-" / "+") is located as the Ext tree expander of the item row; never seen live.
// Ad hoc: collapsing keeps the item row and its checkbox state; the expand control restores the same rows.
test.use(RUN_OPTIONS);

test('NAKIVO collapses and expands an item in the Step 1 source tree', { tag: '@NJM-154745' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  const hasDb = async () => (await flows.readTree()).some((n) => n.name === db && n.depth > 0);
  let before = 0;

  await test.step('1. Precondition and 2. open the wizard: the item is expanded with its databases', async () => {
    await flows.openStep1();
    before = await flows.visibleRowCount();
    expect(await hasDb(), `"${db}" is not shown under the item`).toBe(true);
  });

  await test.step('3. Click the collapse control of the item: its databases are hidden', async () => {
    await flows.toggleExpander(item);
    await expect.poll(hasDb, { timeout: 10_000, message: 'the child databases are still shown after collapsing' }).toBe(false);
    expect((await flows.readTree()).some((n) => n.name === item), 'the item row itself must stay').toBe(true);
    expect(await flows.visibleRowCount()).toBeLessThan(before);
  });

  await test.step('4. Click the expand control of the same item: its databases reappear', async () => {
    await flows.toggleExpander(item);
    await expect.poll(hasDb, { timeout: 10_000, message: 'the child databases did not reappear' }).toBe(true);
    expect(await flows.visibleRowCount()).toBe(before);
  });

  await flows.leaveWizard();
});
