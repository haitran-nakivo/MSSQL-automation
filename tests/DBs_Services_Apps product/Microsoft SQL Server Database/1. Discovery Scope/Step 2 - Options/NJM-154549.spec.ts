import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154549: "[DBM-Inv-UI-Add-Options-0006] Verify Display Name Max Length Highlight".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case expects the field to be highlighted when it reaches the maximum (25). The UI highlights it only above the maximum
//   (26 characters), with the hover text "The maximum length for this field is 25"; the test asserts no highlight at 25 and the highlight with its text at 26.
test.use(RUN_OPTIONS);

const MAX_LENGTH_MESSAGE = /The maximum length for this field is 25/;

test(
  'NAKIVO Add wizard highlights the Display name with the maximum-length message only when it exceeds 25 characters',
  { tag: '@NJM-154549' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
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

    await test.step('3. Enter a Display name that reaches, then exceeds, the maximum length; the field is highlighted with a tooltip only above 25 characters', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects the highlight when the maximum length is reached; the current UI highlights only above the maximum (26 characters) and shows the hover text "The maximum length for this field is 25".' });
      const field = addInventoryItemPage.input('name');
      await wizardFlows.enter('name', 'A'.repeat(25));
      await expect(field).not.toHaveAttribute('aria-invalid', 'true');

      await field.click();
      await field.press('End');
      await field.pressSequentially('B', { delay: 80 });
      await field.press('Tab');
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      await expect
        .poll(
          async () => {
            await page.mouse.move(0, 0);
            return (await wizardFlows.hoverText('name')).join(' | ');
          },
          { message: 'the hover text of the over-long Display name does not give the maximum length' },
        )
        .toMatch(MAX_LENGTH_MESSAGE);
    });
  },
);
