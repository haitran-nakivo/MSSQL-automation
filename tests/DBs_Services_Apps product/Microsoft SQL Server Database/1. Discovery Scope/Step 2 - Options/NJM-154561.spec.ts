import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154561: "[DBM-Inv-UI-Add-Options-0018] Verify Hostname Standard Compliance".
// Lab preconditions: signed-in Director; the standalone instance target of .env (mssqlInstanceTarget) supplies the valid host value, which is only typed.
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case gives no invalid example beyond "spaces or illegal characters"; the test uses "bad host name" (spaces), which the UI flags on blur.
//   The flag is a red border with aria-invalid="true"; the Director shows no inline message.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard flags a Hostname or IP with spaces as invalid and accepts a valid host',
  { tag: '@NJM-154561' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
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

    await test.step('3. Enter a Hostname or IP with spaces; the field is flagged as invalid', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case data is only described ("spaces or illegal characters"); the test types "bad host name". The flag is the red border with aria-invalid="true" (no inline message).' });
      await wizardFlows.enter('host', 'bad host name');
      await expect(addInventoryItemPage.input('host')).toHaveValue('bad host name');
      await expect(addInventoryItemPage.input('host')).toHaveAttribute('aria-invalid', 'true');
    });

    await test.step('4. Replace the value with a valid hostname or IP; the invalid flag clears', async () => {
      const host = addInventoryItemPage.input('host');
      await host.click();
      await host.press('Control+A');
      await host.press('Backspace');
      await wizardFlows.enter('host', target.host);
      await expect(host).toHaveValue(target.host);
      await expect(host).not.toHaveAttribute('aria-invalid', 'true');
    });
  },
);
