import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { P09Flows } from '../../../../../flows/pkg-P09.flows';

// NJM-154654: "[MSSQL-Inv-UI-Details-RS-0003] Verify Title Icon for Read-Scale AG".
// Lab preconditions: the Read-Scale AG host of mssqlReadScaleTarget (10.10.33.141, AG ReadScaleAG) is NOT in Inventory (the test adds it); no Inventory item
//   named RSAG-<host>. If the host is already in Inventory under another name the add ends as a duplicate and the test ends ABORTED. Do not run it in
//   parallel with NJM-154650 (it adds the same host).
// Inventory side effects: adds one item named RSAG-<host>; afterEach removes it (Remove host and keep transporter; a Failed add is cancelled). The host gets
//   a "Physical machine agent" node that stays (keep transporter).
// case-vs-ui (step 1): the test adds and discovers the Read-Scale AG itself (the item is not in the lab Inventory).
// case-vs-ui (step 2): the Inventory page is Settings > Inventory.
// case-vs-ui (step 3): the icon is found by position (an icon element on the line of the item name, before it): the item page has no known locator for it.
//   The test only asserts that the icon is present; its description is attached as evidence.
// case-vs-ui (step 4): the Figma design and the icon "SQLD002" are not available to the test: the identity of the icon and its difference from the other
//   topology icons are not verified (the spec gives SQLD002 to both Read-Scale and Always On).
test.use(RUN_OPTIONS);

const created = new Set<string>();

test.afterEach(async ({ inventoryFlows }) => {
  for (const name of created) {
    try {
      await inventoryFlows.discardIfPresent(name);
    } catch {
      // Best effort: the original failure is what the report shows.
    }
  }
  created.clear();
});

test(
  'NAKIVO Inventory item page of a Read-Scale availability group shows a type icon next to the item name',
  { tag: '@NJM-154654' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page, mssqlReadScaleTarget: target }, testInfo) => {
    test.setTimeout(1_500_000);
    const layout = new P09Flows(page);
    const name = `RSAG-${target.host}`;
    expect(name.length, 'the Display name must stay within 25 characters').toBeLessThanOrEqual(25);

    await test.step('1. Precondition: the Read-Scale availability group is added and discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (await flows.hasItem(name)) throw new Error(`ABORTED: an Inventory item named "${name}" already exists; remove it and run again`);
      await flows.startAdd(ITEM_TYPES.readScale);
      const outcome = await flows.submitAdd({ displayName: name, ...target });
      created.add(name);
      if (outcome === 'duplicate') throw new Error(`ABORTED: ${target.host} is already in Inventory under another name; remove that item and run again`);
      expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
      expect(await flows.waitForDiscovery(name, 600_000), 'discovery of the Read-Scale AG did not complete').toBe('discovered');
      await expect(inventoryPage.row(name).getByText('Failed', { exact: true })).toBeHidden();
    });

    await test.step('2. Open the Inventory page and the details of the Read-Scale AG: the title shows at the top', async () => {
      await expect(inventoryPage.item(name)).toBeVisible();
      await flows.openItem(name);
      await expect(inventoryItemPage.noIssues).toBeVisible();
      expect((await layout.measure(name)).found, 'the item name is not shown in the title').toBe(true);
    });

    await test.step('3. The title shows an icon next to the item name', async () => {
      await expect.poll(async () => (await layout.probeTitleIcon(name)).found, { message: 'no icon is shown before the item name in the title' }).toBe(true);
      await testInfo.attach('title-icon-read-scale-ag', { body: (await layout.probeTitleIcon(name)).descriptor, contentType: 'text/plain' });
    });

    await test.step('4. The icon is the designed Read-Scale AG icon', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154654 step 4: the designed icon SQLD002 / the Figma icon is not available to the test; only the presence of the icon is verified. Its description is attached as evidence.' });
      expect((await layout.probeTitleIcon(name)).found).toBe(true);
    });
  },
);
