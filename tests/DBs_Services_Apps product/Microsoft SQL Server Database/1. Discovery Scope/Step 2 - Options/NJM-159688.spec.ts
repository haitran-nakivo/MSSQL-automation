import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159688: "[MSSQL-Inv-UI-Options-0022-5-2] Verify SQL Username Required - Microsoft SQL Server failover cluster instance".
// Lab preconditions: signed-in Director; the failover cluster target values from .env (typed into the other fields; no host is contacted because Finish is blocked).
// Inventory side effects: none (Finish is blocked by the empty SQL username, so no item is created; the Inventory item count is compared before and after).
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is "Settings > Inventory", the "+" button and the "Application" tile.
// case-vs-ui: the field is labelled "SQL username" (the second username field of the form). "Flagged as required" is the red border with aria-invalid="true" (the message is hover text only).
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard blocks Finish and flags the SQL username as required when it is left empty for a failover cluster instance',
  { tag: '@NJM-159688' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlFciTarget: target }, testInfo) => {
    let itemCountBefore = 0;

    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The SQL host is not contacted by this case; only the signed-in Director and the Application tile are checked.' });
      await flows.gotoInventory();
      itemCountBefore = await inventoryPage.itemCount();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile.' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Set Type = Microsoft SQL Server failover cluster instance; the SQL username field is displayed', async () => {
      await addInventoryItemPage.chooseType(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.input('username', 1)).toBeVisible();
    });

    await test.step('4. Leave the SQL username empty, fill the other mandatory fields and click Finish; adding is blocked and the SQL username is flagged as required', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The other mandatory fields of the failover cluster form are Hostname or IP, OS username and Instance name (the case data names the instance); the OS password is filled as well.' });
      await expect(addInventoryItemPage.input('username', 1)).toHaveValue('');
      await wizardFlows.enter('host', target.host);
      await wizardFlows.enter('username', target.osUsername, 0);
      await wizardFlows.enter('password', target.osPassword, 0);
      await wizardFlows.enter('instanceName', target.instanceName);
      await page.getByRole('button', { name: 'Finish' }).click();
      await expect(addInventoryItemPage.input('username', 1)).toHaveAttribute('aria-invalid', 'true');
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'false');
      await expect(addInventoryItemPage.input('instanceName')).toHaveAttribute('aria-invalid', 'false');
      // Nothing was added: the rows are not visible while the wizard is open, so the list is reloaded before it is counted.
      await flows.gotoInventory();
      expect(await inventoryPage.itemCount(), 'the Inventory item count changed after the blocked Finish').toBe(itemCountBefore);
    });
  },
);
