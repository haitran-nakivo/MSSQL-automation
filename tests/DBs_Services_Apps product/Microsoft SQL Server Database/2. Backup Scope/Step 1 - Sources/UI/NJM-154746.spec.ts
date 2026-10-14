import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154746: "[DBM-BK-UI-Source-Left Pane-0008] Verify Tree Format and Icons".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM (an existing Inventory item with databases).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the case names the design asset "SQLD001"; the DOM does not carry design asset ids, so the icon is identified by its image / class
//   signature (attached as observed-outcome) and the checks are: the item and its databases have an icon, and the item icon differs from the database icon.
// case-vs-ui: step 4 compares SQL with other platforms (for example Oracle): the Backup for Database wizard lists SQL Server items only, so only the SQL icons are compared.
// UNVERIFIED: the icon element (img / class*=icon in the row) was never inspected live.
test.use(RUN_OPTIONS);

test('NAKIVO shows an icon for the SQL item and for its databases in the Step 1 source tree', { tag: '@NJM-154746' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const item = readBackupValue('INSTANCE_ITEM');

  await test.step('1. Precondition and 2. open the wizard: Step 1 lists the item with its databases', async () => {
    await flows.openStep1();
  });

  await test.step('3. Observe the icons of the SQL item and its databases: each row has an icon', async () => {
    const tree = await flows.readTree();
    const at = tree.findIndex((n) => n.name === item);
    expect(at, `the tree does not list "${item}"`).toBeGreaterThanOrEqual(0);
    const dbNode = tree.find((n, i) => i > at && n.depth > tree[at].depth);
    testInfo.annotations.push({ type: 'observed-outcome', description: `item icon: ${tree[at].iconSignature || '(none found)'}; database icon: ${dbNode?.iconSignature || '(none found)'}` });
    expect(tree[at].iconSignature, 'the item row has no icon').not.toBe('');
    expect(dbNode?.iconSignature, 'the database row has no icon').toBeTruthy();
  });

  await test.step('4. Compare the icons across platforms: the container icon differs from the database icon, and equal item types share one icon', async () => {
    const tree = await flows.readTree();
    const containers = tree.filter((n) => n.depth === 0);
    const databases = tree.filter((n) => n.depth > 0);
    const containerIcons = new Set(containers.map((n) => n.iconSignature));
    const databaseIcons = new Set(databases.map((n) => n.iconSignature));
    expect([...containerIcons].filter((icon) => databaseIcons.has(icon)), 'a container uses a database icon').toEqual([]);
    expect(containerIcons.size, 'container icons seen').toBeLessThanOrEqual(2);
  });

  await flows.leaveWizard();
});
