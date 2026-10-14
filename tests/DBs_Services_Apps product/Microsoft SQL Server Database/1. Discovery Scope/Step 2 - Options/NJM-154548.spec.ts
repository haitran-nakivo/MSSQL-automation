import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154548: "[DBM-Inv-UI-Add-Options-0005] Verify Display Name Length Limits".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case says input beyond the maximum is rejected. The UI does not block the 26th character: the field keeps it and is flagged
//   (aria-invalid="true", hover text "The maximum length for this field is 25"); the test asserts that behavior.
test.use(RUN_OPTIONS);

const MAX_LENGTH = 25;
const MAX_LENGTH_MESSAGE = /The maximum length for this field is 25/;

test(
  'NAKIVO Add wizard accepts a Display name of 25 characters and flags the field when a 26th character is typed',
  { tag: '@NJM-154548' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
    const maxName = 'A'.repeat(MAX_LENGTH);

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

    await test.step('3. Type 25 characters into the Display name; all of them are accepted', async () => {
      await wizardFlows.enter('name', maxName);
      await expect(addInventoryItemPage.input('name')).toHaveValue(maxName);
      await expect(addInventoryItemPage.input('name')).not.toHaveAttribute('aria-invalid', 'true');
    });

    await test.step('4. Type one more character; the field is flagged invalid with the maximum-length message', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects characters beyond the maximum to be rejected; the current UI keeps the 26th character and flags the field with the hover text "The maximum length for this field is 25".' });
      const field = addInventoryItemPage.input('name');
      await field.click();
      await field.press('End');
      await field.pressSequentially('B', { delay: 80 });
      await field.press('Tab');
      await expect(field).toHaveValue(`${maxName}B`);
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
