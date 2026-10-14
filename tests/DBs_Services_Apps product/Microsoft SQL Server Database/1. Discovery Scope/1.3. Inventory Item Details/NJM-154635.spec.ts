import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';
import { ObsBFlows } from '../../../../../flows/pkg-obsB.flows';

// NJM-154635: "[DBM-Inv-UI-Details-0002] Verify General Inventory Details Behavior".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 is in Inventory, discovered (shows "N databases").
// Inventory side effects: none (the item is only read; Refresh is NOT clicked on this pre-existing item).
// case-vs-ui (step 2): the Inventory page is Settings > Inventory.
// case-vs-ui (step 3): the item page shows "General information" and the "Instance details" section.
// case-vs-ui (step 4): Refresh is not clicked (owner rule: no Refresh on pre-existing items). Only the Refresh button of the item page is asserted
//   (visible, enabled); the re-discovery, the update of the page and the retained context after a Refresh are not verified.
// case-vs-ui (step 5): the item page has no Close control; the user returns with the Settings > Inventory navigation. The test goes to the Inventory list
//   again and asserts the item is still listed.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page of a SQL instance shows general information and a Refresh button, and the item stays in the Inventory list',
  { tag: '@NJM-154635' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const obs = new ObsBFlows(page);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the SQL instance is discovered in the Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.item(name)).toBeVisible();
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory view: the Inventory list is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154635 step 2: the Inventory view is Settings > Inventory.' });
      await expect(inventoryPage.row(name)).toBeVisible();
    });

    await test.step('3. Select the SQL item: the Details page opens and shows the general information', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154635 step 3: the details open as an item page with "General information" and "Instance details".' });
      await flows.openItem(name);
      await expect(page.getByText('General information', { exact: true }).filter({ visible: true })).toBeVisible();
      await expect(inventoryItemPage.detail('Type:')).toHaveText('Microsoft SQL Server instance');
      await expect(inventoryItemPage.detail('Total databases:')).toHaveText(/^\d+$/);
    });

    await test.step('4. The item page offers Refresh (the button is asserted, not clicked)', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154635 step 4: Refresh is not clicked on a pre-existing item; re-discovery and the updated Details view are not verified.' });
      const refresh = obs.refreshButton();
      await expect(refresh).toBeVisible();
      await expect(refresh).toBeEnabled();
      await expect(refresh).toContainText('Refresh');
    });

    await test.step('5. Return to the Inventory list: the list is shown with the item still present', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154635 step 5: the item page has no Close control; the test returns through Settings > Inventory.' });
      await flows.gotoInventory();
      await expect(inventoryPage.item(name)).toBeVisible();
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });
  },
);
