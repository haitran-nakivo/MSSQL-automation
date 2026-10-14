import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-159683: "[MSSQL-Inv-UI-Options-0019] Verify AG Name Tooltip".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (the wizard is left by the test ending).
// case-vs-ui: Xray "Configuration > Inventory > Add New > Application/Database > Microsoft SQL Server" is "Settings > Inventory", the "+" button and the "Application" tile.
// case-vs-ui: the case steps use the Always On availability group type (the wizard default), as written; the field is labelled "AG name".
// case-vs-ui: the case states no tooltip text; the spec text ("AG settings") differs in wording from the UI, so only that a tooltip about the availability group appears is asserted and the exact text is attached as evidence.
test.use(RUN_OPTIONS);

const AVAILABILITY_GROUP_TYPE = 'Microsoft SQL Server Always On availability group';

test(
  'NAKIVO Add wizard shows a tooltip describing the AG name when the information icon of the AG name field is hovered',
  { tag: '@NJM-159683' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
    await test.step('1. Precondition: Director is accessible and the Microsoft SQL Server platform is available in Add', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The SQL host is not contacted by this case; only the signed-in Director and the Application tile are checked.' });
      await flows.gotoInventory();
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

    await test.step('3. Set Type = Microsoft SQL Server Always On availability group; the AG name field and its information icon are displayed', async () => {
      await addInventoryItemPage.chooseType(AVAILABILITY_GROUP_TYPE);
      await expect(addInventoryItemPage.typeField).toHaveValue(AVAILABILITY_GROUP_TYPE);
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
      await expect(wizardFlows.infoIcon('availabilityGroupName')).toBeVisible();
    });

    await test.step('4. Hover the information icon of the AG name field; a tooltip describing the AG name is shown', async () => {
      const texts = await wizardFlows.tooltip('availabilityGroupName');
      await testInfo.attach('ag-name-tooltip-text', { body: texts.join('\n'), contentType: 'text/plain' });
      expect(texts.length, 'no tooltip text appeared when the AG name information icon was hovered').toBeGreaterThan(0);
      expect(texts.join(' '), 'the tooltip does not mention the availability group').toMatch(/\bAG\b|availability group/i);
    });
  },
);
