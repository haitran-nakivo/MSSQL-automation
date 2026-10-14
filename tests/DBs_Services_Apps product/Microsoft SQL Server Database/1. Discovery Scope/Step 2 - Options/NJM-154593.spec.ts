import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154593: "[MSSQL-Inv-UI-Options-0018] Verify AG Name Tooltip".
// Lab preconditions: signed-in Director with the Microsoft SQL Server platform available in Add Inventory Item (the SQL host is not used).
// Inventory side effects: none (the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: the case leaves the AG type open; the type Microsoft SQL Server Always On availability group (the wizard default) is used.
// case-vs-ui: the case states no tooltip text; only that a tooltip with text appears is asserted and the shown text is attached as evidence (no exact wording, truncation or placeholder check).
test.use(RUN_OPTIONS);

const AVAILABILITY_GROUP_TYPE = 'Microsoft SQL Server Always On availability group';

test(
  'NAKIVO Add wizard shows a tooltip with text when the pointer rests on the info icon of the AG name',
  { tag: '@NJM-154593' },
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

    await test.step('3. Select an Availability Group type; the AG name field is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case leaves the AG type open; the Always On availability group type (the wizard default) is used.' });
      await expect(addInventoryItemPage.typeField).toHaveValue(AVAILABILITY_GROUP_TYPE);
      await expect(addInventoryItemPage.input('availabilityGroupName')).toBeVisible();
    });

    await test.step('4. Hover the info icon of the AG name field; a tooltip with text appears', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case states no expected wording; the test asserts that a tooltip text appears and attaches it. Exact wording, truncation and placeholder are not checked.' });
      await expect(wizardFlows.infoIcon('availabilityGroupName')).toBeVisible();
      const texts = await wizardFlows.tooltip('availabilityGroupName');
      await testInfo.attach('ag-name-tooltip-text', { body: texts.join('\n'), contentType: 'text/plain' });
      expect(texts.length, 'no tooltip text appeared when hovering the info icon of the AG name').toBeGreaterThan(0);
      expect(texts.join(' ').trim().length, 'the tooltip of the AG name is empty').toBeGreaterThan(0);
    });
  },
);
