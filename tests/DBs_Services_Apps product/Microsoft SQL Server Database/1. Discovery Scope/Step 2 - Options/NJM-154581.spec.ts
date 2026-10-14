import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154581: "[MSSQL-Inv-UI-Options-0002-6] Verify Hostname Tooltip (AG)".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the Always On availability group type is the wizard default, so step 3 checks the selection instead of changing it.
// case-vs-ui: the case states no tooltip wording; the exact text asserted is the one observed on Director 11.2.1.112232 (2026-10-09).
test.use(RUN_OPTIONS);

const AVAILABILITY_GROUP_TYPE = 'Microsoft SQL Server Always On availability group';
const EXPECTED_TOOLTIP = 'Use the hostname or IP address of the Windows Server Failover Cluster (WSFC) that hosts the Always On Availability Group (AG).';

test(
  'NAKIVO Add wizard shows the AG-specific tooltip on the Hostname info icon of the Always On availability group type',
  { tag: '@NJM-154581' },
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

    await test.step('3. Set the Type to Always On Availability Group (AG); the type is selected and the Hostname field is shown', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Always On availability group type is the wizard default; the test checks that it is selected.' });
      await expect(addInventoryItemPage.typeField).toHaveValue(AVAILABILITY_GROUP_TYPE);
      await expect(addInventoryItemPage.input('host')).toBeVisible();
    });

    await test.step('4. Hover the info icon of the Hostname field; a tooltip with the AG-specific guidance text appears', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case gives no wording; the observed text is asserted in full (so no truncation or placeholder).' });
      await expect(wizardFlows.infoIcon('host')).toBeVisible();
      const texts = await wizardFlows.tooltip('host');
      await testInfo.attach('hostname-tooltip-ag', { body: texts.join('\n'), contentType: 'text/plain' });
      expect(texts, 'the Hostname tooltip of the Always On type does not show the expected text').toContain(EXPECTED_TOOLTIP);
    });
  },
);
