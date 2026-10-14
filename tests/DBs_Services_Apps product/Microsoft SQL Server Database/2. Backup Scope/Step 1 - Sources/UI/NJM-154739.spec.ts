import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154739: "[DBM-BK-UI-Source-Left Pane-0002] Verify No Matching Items View".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM (an existing Inventory item with databases).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: "Jobs > Create" is Data Protection > "+" > Backup for Database.
// UNVERIFIED: the empty-state wording is taken from the case ("No matching items"); the Director may word it differently.
test.use(RUN_OPTIONS);

const NO_MATCH_TEXT = 'zzz-no-such-database-0000';

test('NAKIVO shows a "No matching items" state in the source tree when the search matches nothing and restores the tree when cleared', { tag: '@NJM-154739' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const item = readBackupValue('INSTANCE_ITEM');
  let fullCount = 0;

  await test.step('1. Precondition: the SQL item from .env is listed in the source tree', async () => {
    await flows.openStep1();
    fullCount = await flows.visibleRowCount();
    expect((await flows.readTree()).some((n) => n.name === item), `the tree does not list "${item}"`).toBe(true);
  });

  await test.step('2. The wizard is open on Step 1 (Source)', async () => {
    await expect(flows.sources.stepTab('Source')).toBeVisible();
  });

  await test.step('3. Type a term that matches no database into the live search field: the tree filters', async () => {
    await flows.typeSearch(NO_MATCH_TEXT);
    await expect.poll(() => flows.visibleRowCount(), { timeout: 15_000, message: 'the tree did not filter while typing' }).toBeLessThan(fullCount);
  });

  await test.step('4. Observe the tree: a "No matching items" state is shown and no tree nodes remain', async () => {
    expect(await flows.visibleRowCount()).toBe(0);
    const shown = await flows.sources.noMatchText.isVisible();
    testInfo.annotations.push({ type: 'observed-outcome', description: `"No matching items" text visible: ${shown}` });
    await expect(flows.sources.noMatchText).toBeVisible();
  });

  await test.step('5. Clear the search field: the full tree is restored', async () => {
    await flows.clearSearch();
    await expect.poll(() => flows.visibleRowCount(), { timeout: 15_000, message: 'the full tree was not restored' }).toBe(fullCount);
    await expect(flows.sources.noMatchText).toBeHidden();
  });

  await flows.leaveWizard();
});
