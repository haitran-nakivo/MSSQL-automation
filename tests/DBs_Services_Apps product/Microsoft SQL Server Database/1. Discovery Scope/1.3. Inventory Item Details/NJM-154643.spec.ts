import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';

// NJM-154643: "[DBM-Inv-UI-Details-0010] Verify General Info - Operating System".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 (host 10.10.19.145, Windows Server 2022) is in Inventory and discovered.
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 2): the Inventory page is Settings > Inventory.
// case-vs-ui (step 3): the field is labelled "Operating system" in NBR 11.2.1.
// case-vs-ui (step 4): the value is compared with the OS known for the lab host (Windows Server 2022), not with a value read from the machine
//   (no host-side client exists in the project yet).
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page General information shows the operating system of the SQL host',
  { tag: '@NJM-154643' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage }, testInfo) => {
    test.setTimeout(300_000);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the SQL item is discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page and the details of the SQL item: General information is shown', async () => {
      await flows.openItem(name);
      await expect(inventoryItemPage.text('General information')).toBeVisible();
    });

    await test.step('3. The General information section has an Operating system field with a value', async () => {
      await expect(inventoryItemPage.detail('Operating system')).toHaveText(/\S/);
    });

    await test.step('4. The field shows the OS of the SQL source machine', async () => {
      await expect.poll(() => flows.readItemDetails(), { message: 'the Operating system field does not show Windows Server 2022' }).toMatchObject({ os: expect.stringMatching(/Windows Server 2022/) });
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154643 step 4: compared with the OS known for the lab host (Windows Server 2022); the OS is not read from the machine.' });
    });
  },
);
