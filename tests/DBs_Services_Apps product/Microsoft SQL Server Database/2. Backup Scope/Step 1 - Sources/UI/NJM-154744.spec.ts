import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154744: "[DBM-BK-UI-Source-Left Pane-0006] Verify Default Tree Expansion".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE.
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: "Jobs > Create" is Data Protection > "+" > Backup for Database. Observed: every item is listed with its databases (no tempdb) without any click.
test.use(RUN_OPTIONS);

test('NAKIVO shows the Step 1 source tree expanded down to the databases by default', { tag: '@NJM-154744' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');

  await test.step('1. Precondition and 2. open the wizard on Step 1 (no node is expanded or collapsed by the test)', async () => {
    await flows.openStep1();
  });

  await test.step('3. Observe the tree without expanding anything: items and their child databases are shown', async () => {
    const tree = await flows.readTree();
    const at = tree.findIndex((n) => n.name === item);
    expect(at, `the tree does not list "${item}"`).toBeGreaterThanOrEqual(0);
    expect(tree.some((n, i) => i > at && n.depth > tree[at].depth), 'the item is collapsed: no child database is shown').toBe(true);
  });

  await test.step('4. Confirm the child databases are visible under the item without manual expansion', async () => {
    const tree = await flows.readTree();
    const at = tree.findIndex((n) => n.name === item);
    const children: string[] = [];
    for (let i = at + 1; i < tree.length && tree[i].depth > tree[at].depth; i++) children.push(tree[i].name);
    expect(children).toContain(db);
    expect(children, 'tempdb must not be offered as a source').not.toContain('tempdb');
  });

  await flows.leaveWizard();
});
