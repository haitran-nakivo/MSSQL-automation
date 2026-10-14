import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154738: "[DBM-BK-UI-Source-Left Pane-0001] Verify Source Step Default View".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM (an existing Inventory item with databases).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the case says "open Jobs, click Create": the UI is Data Protection > "+" > Backup for Database.
// case-vs-ui: "right pane empty by default": the UI shows the empty-state text "Select at least one item on the left" and no selected items.
// UNVERIFIED: the license details label (position, text) was never seen live; it is looked up by the word "license".
test.use(RUN_OPTIONS);

test('NAKIVO shows the Step 1 Sources page with the Inventory tree, an empty selection panel, a live search field and a license label', { tag: '@NJM-154738' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const item = readBackupValue('INSTANCE_ITEM');

  await test.step('1. Precondition: the SQL item from .env and its databases are in Inventory', async () => {
    const rows = await flows.readInventoryRows();
    expect(BkA3SourcesFlows.positionsIn(rows, [item])[0], `Inventory does not list "${item}"`).toBeGreaterThanOrEqual(0);
  });

  await test.step('2. Open Data Protection > + > Backup for Database: the wizard opens on Step 1 (Source)', async () => {
    await flows.openStep1();
    await expect(flows.backup.wizard.title).toBeVisible();
    await expect(flows.sources.stepTab('Source')).toBeVisible();
  });

  await test.step('3. Observe the left pane: the Inventory tree lists the SQL item with its databases', async () => {
    const tree = await flows.readTree();
    const itemIndex = tree.findIndex((n) => n.name === item);
    expect(itemIndex, `the tree does not list "${item}"`).toBeGreaterThanOrEqual(0);
    expect(tree.some((n, i) => i > itemIndex && n.depth > tree[itemIndex].depth), 'the item shows no child databases').toBe(true);
  });

  await test.step('4. Observe the right pane: nothing is selected', async () => {
    await expect(flows.sources.selectionSummary).toHaveText(/Select at least one item on the left/);
    expect((await flows.readTree()).filter((n) => n.checked)).toHaveLength(0);
  });

  await test.step('5. Observe the top of the left pane and the footer of the right pane: a search field and a license label', async () => {
    await expect(flows.sources.searchField).toBeVisible();
    const label = await flows.readLicenseLabel();
    testInfo.annotations.push({ type: 'observed-outcome', description: `license label text: "${label.text}"` });
    expect(label.text, 'no license details label was found in the wizard').toMatch(/licen[sc]e/i);
  });

  await flows.leaveWizard();
});
