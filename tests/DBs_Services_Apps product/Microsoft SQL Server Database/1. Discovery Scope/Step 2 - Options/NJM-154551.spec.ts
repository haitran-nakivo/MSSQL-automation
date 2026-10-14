import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154551: "[DBM-Inv-UI-Add-Options-0008] Verify Display Name Truncation".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the case expects a long Display name to be truncated (for example with an ellipsis) in the field while the full value is retained, and its title says the auto-filled
//   Hostname is truncated to 25 characters. The Display name field allows at most 25 characters: the UI does not truncate the value, it keeps the 26th character and flags the
//   field (aria-invalid="true", hover text "The maximum length for this field is 25"). The test asserts that, with a 26-character value as the "longer" name.
// case-vs-ui: the case data "<long-display-name exceeding field width>" is undefined; 26 characters are used because the field flags the 26th character.
// ambiguity: "longer than the visible width of the field" and "truncate to 25 characters" do not describe the same thing; the 25-character limit is observed as the 26th character
//   being invalid, not as truncation. The auto-fill of the Display name from the Hostname is covered by NJM-154550.
// notVerified: visual ellipsis truncation inside the field (no such behaviour observed) and the truncation of an auto-filled hostname.
test.use(RUN_OPTIONS);

const MAX_LENGTH = 25;
const MAX_LENGTH_MESSAGE = /The maximum length for this field is 25/;

test(
  'NAKIVO Add wizard keeps a 26-character Display name unchanged and flags it with the 25-character maximum message',
  { tag: '@NJM-154551' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
    const longName = 'L'.repeat(MAX_LENGTH + 1);

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

    await test.step('3. Enter a Display name longer than the maximum (26 characters); the value is kept and the field is flagged', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects truncation (ellipsis) with the full value retained; the UI keeps all 26 characters untruncated and flags the field (aria-invalid="true") with the hover text "The maximum length for this field is 25". The limit is observed as the 26th character being invalid; see the ambiguity in the header.' });
      await wizardFlows.enter('name', longName);
      const field = addInventoryItemPage.input('name');
      await expect(field).toHaveValue(longName);
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
