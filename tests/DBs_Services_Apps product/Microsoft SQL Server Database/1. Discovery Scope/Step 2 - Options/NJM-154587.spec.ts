import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154587: "[MSSQL-Inv-UI-Options-0009] Verify Instance Name Tooltip (FCI)".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the case states no tooltip wording; the exact text asserted is the one observed on Director 11.2.1.112232 (2026-10-09).
test.use(RUN_OPTIONS);

const EXPECTED_TOOLTIP = 'The SQL Server Failover Cluster Instance (FCI) name which is configured in the Windows Server Failover Cluster (WSFC).';

test(
  'NAKIVO Add wizard shows the FCI-specific tooltip on the Instance name info icon of the failover cluster instance type',
  { tag: '@NJM-154587' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile. Xray step 2 "Add New" is merged into step 1 (the wizard is already open).' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Set the Type to Failover Cluster Instance (FCI); the type is selected and the Instance name field is shown', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The type is listed as "Microsoft SQL Server failover cluster instance" in the current UI.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.failoverCluster);
      await expect(addInventoryItemPage.input('instanceName')).toBeVisible();
    });

    await test.step('4. Hover the info icon of the Instance name field; a tooltip with the FCI-specific guidance text appears', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case gives no wording; the observed text is asserted in full (so no truncation or placeholder).' });
      await expect(wizardFlows.infoIcon('instanceName')).toBeVisible();
      const texts = await wizardFlows.tooltip('instanceName');
      await testInfo.attach('instance-name-tooltip-fci', { body: texts.join('\n'), contentType: 'text/plain' });
      expect(texts, 'the Instance name tooltip of the FCI type does not show the expected text').toContain(EXPECTED_TOOLTIP);
    });
  },
);
