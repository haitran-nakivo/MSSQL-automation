import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS, P09Flows } from '../../../../../flows/pkg-P09.flows';

// NJM-154641: "[DBM-Inv-UI-Details-0008] Verify General Info - Hostname".
// Lab preconditions: the standalone instance item WS2022-SQL2025-19.145 (host of mssqlInstanceTarget, 10.10.19.145) is in Inventory and discovered.
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 2): the Inventory page is Settings > Inventory.
// case-vs-ui (steps 3-4): the General information field is labelled "Display name" (not "Hostname") and shows the Hostname or IP the item was added with,
//   not the machine name; it is compared with the host of mssqlInstanceTarget. The machine host name of the SQL source is not read.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page General information shows the host the item was added with',
  { tag: '@NJM-154641' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, mssqlInstanceTarget: target }, testInfo) => {
    test.setTimeout(300_000);
    const layout = new P09Flows(page);
    const name = LAB_ITEMS.instance;

    await test.step('1. Precondition: the SQL item is discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.discoveredDetails(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory page and the details of the SQL item: General information is shown', async () => {
      await flows.openItem(name);
      await expect(page.getByText('General information', { exact: true }).filter({ visible: true })).toBeVisible();
    });

    await test.step('3. The General information section has a host field with a value', async () => {
      await expect
        .poll(() => layout.readValueByLabel(/^Display name:?$/), { message: 'General information shows no "Display name" field with a value' })
        .toMatch(/\S/);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154641 step 3: the field is labelled "Display name" in NBR 11.2.1, not "Hostname".' });
    });

    await test.step('4. The field shows the host of the SQL source', async () => {
      expect(await layout.readValueByLabel(/^Display name:?$/)).toBe(target.host);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154641 step 4: the value is the Hostname or IP the item was added with (the host of mssqlInstanceTarget); the machine host name of the SQL source is not read.' });
    });
  },
);
