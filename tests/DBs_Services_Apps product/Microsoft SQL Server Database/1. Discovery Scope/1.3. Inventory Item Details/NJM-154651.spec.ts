import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS, P09Flows } from '../../../../../flows/pkg-P09.flows';

// NJM-154651: "[MSSQL-Inv-UI-Details-instance-0003] Verify Title Icon for Instance".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 is in Inventory and discovered.
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 2): the Inventory page is Settings > Inventory.
// case-vs-ui (step 3): the icon is found by position (an icon element on the line of the item name, before it): the item page has no known locator for it.
//   The test only asserts that the icon is present; its description is attached as evidence.
// case-vs-ui (step 4): the Figma design and the icon "SQLD001" are not available to the test: the identity of the icon and its difference from the FCI and
//   AG icons are not verified.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page of a standalone SQL instance shows a type icon next to the item name',
  { tag: '@NJM-154651' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const layout = new P09Flows(page);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the standalone SQL instance is discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page and the details of the standalone instance: the title shows at the top', async () => {
      await expect(inventoryPage.item(name)).toBeVisible();
      await flows.openItem(name);
      await expect(inventoryItemPage.noIssues).toBeVisible();
      expect((await layout.measure(name)).found, 'the item name is not shown in the title').toBe(true);
    });

    await test.step('3. The title shows an icon next to the item name', async () => {
      await expect.poll(async () => (await layout.probeTitleIcon(name)).found, { message: 'no icon is shown before the item name in the title' }).toBe(true);
      await testInfo.attach('title-icon-instance', { body: (await layout.probeTitleIcon(name)).descriptor, contentType: 'text/plain' });
    });

    await test.step('4. The icon is the designed standalone-instance icon', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154651 step 4: the designed icon SQLD001 / the Figma icon is not available to the test; only the presence of the icon is verified. Its description is attached as evidence.' });
      expect((await layout.probeTitleIcon(name)).found).toBe(true);
    });
  },
);
