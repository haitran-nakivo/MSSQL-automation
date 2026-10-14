import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154539: "[DBM-Inv-UI-Add-Platform-0002] Verify Application Subtext".
// Lab preconditions: signed-in Director whose license includes Microsoft SQL Server (the Application tile is enabled).
// Inventory side effects: none (the wizard is only opened; nothing is added).
// case-vs-ui: Xray "Microsoft SQL Server platform option" is the "Application" tile of the Platform step; the subtext sits under "Application".
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the subtext "Oracle database, Microsoft SQL Server." under the Application platform',
  { tag: '@NJM-154539' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    const application = page.getByText('Application', { exact: true }).filter({ visible: true });
    const subtext = page.getByText(/Oracle database, Microsoft SQL Server\./).filter({ visible: true });

    await test.step('1. Precondition: the Add wizard is open on the Platform step with Microsoft SQL Server licensed', async () => {
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(addInventoryItemPage.platformRadio('Application')).toBeEnabled();
    });

    await test.step('2. Locate the Application platform option; it is visible', async () => {
      await expect(application).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154539 step 2: the option is the "Application" tile; there is no "Microsoft SQL Server" tile.' });
    });

    await test.step('3. A descriptive subtext is shown beneath the option label', async () => {
      await expect(subtext).toBeVisible();
      const boxes = { label: await application.boundingBox(), subtext: await subtext.boundingBox() };
      expect(boxes.label, 'the Application label has no box').not.toBeNull();
      expect(boxes.subtext, 'the subtext has no box').not.toBeNull();
      expect(boxes.subtext!.y, 'the subtext is not beneath the Application label').toBeGreaterThan(boxes.label!.y);
    });

    await test.step('4. The subtext identifies the platform as Microsoft SQL Server (with Oracle database)', async () => {
      await expect(subtext).toContainText('Oracle database, Microsoft SQL Server.');
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154539 step 4: the subtext names Oracle database as well as Microsoft SQL Server (the case expects Microsoft SQL Server only).' });
    });
  },
);
