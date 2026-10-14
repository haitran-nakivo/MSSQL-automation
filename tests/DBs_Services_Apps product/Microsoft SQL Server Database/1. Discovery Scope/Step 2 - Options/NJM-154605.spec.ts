import { test, expect } from '../../../../../fixtures';
import { ITEM_TYPES } from '../../../../../flows/inventory.flows';
import { appendValue, replaceValue } from '../../../../../flows/pkg-obsa.flows';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154605: "[MSSQL-Inv-UI-Options-0023-6-7-1] Verify SQL Password Text Support & Length".
// Lab preconditions: signed-in Director (no SQL target is needed; the typed values are fixed test strings, not real credentials).
// Inventory side effects: none (nothing is submitted; the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Configuration > Inventory > Add New" is "Settings > Inventory" and the "+" button; Xray "Microsoft SQL Server" is the "Application" tile.
// case-vs-ui: no Xray step selects the type; Microsoft SQL Server instance is chosen in step 3.
// case-vs-ui: the case data "<mixed-char-password>" and "<max-length-password>" are undefined; a fixed mixed value and 511 characters (the observed limit) are used.
// case-vs-ui: the case expects input beyond the limit to be rejected or truncated. The UI keeps the 512th character and flags the field (aria-invalid="true").
// notVerified: Unicode characters in the SQL password (named in the case title; not observed, and the case steps type letters, digits and special characters only).
test.use(RUN_OPTIONS);

const MAX_LENGTH = 511;
const MIXED_PASSWORD = 'Ab1!@#$%^&*()_+-=';

test(
  'NAKIVO Add wizard accepts a mixed-character SQL password and a 511-character one, and flags the field when a 512th character is typed',
  { tag: '@NJM-154605' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    test.setTimeout(240_000);
    const field = addInventoryItemPage.input('password', 1);
    const maxPassword = 'p'.repeat(MAX_LENGTH);

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

    await test.step('3. Type a password with letters, digits and special characters into the SQL password; all character types are accepted', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'No Xray step selects the type (Microsoft SQL Server instance is chosen); the case data is undefined, so a fixed mixed value is typed.' });
      await addInventoryItemPage.chooseType(ITEM_TYPES.instance);
      await expect(addInventoryItemPage.typeField).toHaveValue(ITEM_TYPES.instance);
      await replaceValue(field, MIXED_PASSWORD);
      await expect(field).toHaveValue(MIXED_PASSWORD);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
    });

    await test.step('4. Type a password of the maximum allowed length (511), then one more character; 511 are accepted and the 512th is flagged', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects input beyond the limit to be rejected or truncated; the UI keeps the 512th character and flags the field (aria-invalid="true").' });
      await replaceValue(field, maxPassword);
      await expect(field).toHaveValue(maxPassword);
      await expect(field).toHaveAttribute('aria-invalid', 'false');
      await appendValue(field, 'x');
      await expect(field).toHaveValue(`${maxPassword}x`);
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    });
  },
);
