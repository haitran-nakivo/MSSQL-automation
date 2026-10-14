import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154575: "[DBM-Inv-UI-Add-Options-0032] Verify Cancel Button Enabled State".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (nothing is added; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: "at all times regardless of field validation state" is checked in three states: freshly opened empty form, form with
//   fields marked invalid (after tabbing through the empty form), and after a Finish that the form blocked.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard keeps the Cancel button enabled whatever the validation state of the Options form',
  { tag: '@NJM-154575' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
    const cancel = page.getByText('Cancel', { exact: true }).filter({ visible: true });

    await test.step('1. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens at the Platform step', async () => {
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

    await test.step('3. Observe the Cancel button on the Options page in the empty, invalid and blocked-Finish states; it is enabled in each', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: '"At all times" is verified in three states: empty form, fields marked invalid, and after a blocked Finish.' });
      await expect(cancel).toBeEnabled();

      await wizardFlows.touchAll();
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'true');
      await expect(cancel).toBeEnabled();

      await page.getByRole('button', { name: 'Finish' }).click();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(cancel).toBeEnabled();
    });
  },
);
