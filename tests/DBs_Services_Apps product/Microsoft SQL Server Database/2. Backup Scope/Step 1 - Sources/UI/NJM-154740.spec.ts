import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154740: "[DBM-BK-UI-Source-Left Pane-0003] Verify Item Selection View".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (a database on that item).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: "Jobs > Create" is Data Protection > "+" > Backup for Database. The tree is already expanded down to the databases (see NJM-154744).
// case-vs-ui: "visually highlighted" is recorded as an observed-outcome (the row class), only the checked state is asserted.
test.use(RUN_OPTIONS);

test('NAKIVO checks a selected database in the source tree and lists it in the right pane', { tag: '@NJM-154740' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');

  await test.step('1. Precondition: the SQL item from .env is in Inventory and the wizard is open on Step 1', async () => {
    await flows.openStep1();
    expect((await flows.readTree()).some((n) => n.name === item), `the tree does not list "${item}"`).toBe(true);
  });

  await test.step('2. The wizard is open on Step 1 (Source)', async () => {
    await expect(flows.sources.stepTab('Source')).toBeVisible();
  });

  await test.step('3. Expand the SQL item: its databases are listed as child items', async () => {
    let tree = await flows.readTree();
    const at = tree.findIndex((n) => n.name === item);
    if (!tree.some((n, i) => i > at && n.depth > tree[at].depth)) await flows.toggleExpander(item);
    await expect.poll(async () => (await flows.readTree()).some((n) => n.name === db && n.depth > 0), { timeout: 10_000, message: `"${db}" is not listed under the item` }).toBe(true);
    tree = await flows.readTree();
    expect(tree.find((n) => n.name === db)?.checked).toBe(false);
  });

  await test.step('4. Tick the database checkbox: it is checked in the tree', async () => {
    await flows.clickCheckbox(db);
    await expect.poll(() => flows.isChecked(db), { timeout: 10_000, message: 'the database did not become checked' }).toBe(true);
    const node = (await flows.readTree()).find((n) => n.name === db);
    testInfo.annotations.push({ type: 'observed-outcome', description: `row highlighted class after ticking: ${node?.highlighted}` });
  });

  await test.step('5. Observe the right pane: the selected database is listed', async () => {
    await expect.poll(() => flows.paneCount(db), { timeout: 10_000, message: 'the database is not listed in the right pane' }).toBe(1);
    await expect(flows.sources.selectionSummary).toHaveText(/item\(s\) were added to this job/);
  });

  await flows.leaveWizard();
});
