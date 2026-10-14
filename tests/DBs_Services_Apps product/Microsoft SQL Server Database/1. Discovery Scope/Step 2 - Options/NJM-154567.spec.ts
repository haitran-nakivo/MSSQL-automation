import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { ObsBFlows } from '../../../../../flows/pkg-obsB.flows';

// NJM-154567: "[DBM-Inv-UI-Add-Options-0024] Verify Credentials Dialog Behavior".
// Lab preconditions: signed-in Director; the OS username of the standalone instance target (mssqlInstanceTarget) is a Password-type credential already in the
//   shared credential store (it is listed in the dialog and in the OS username drop-down).
// Inventory side effects: none. The dialog is only read and closed; no credential is added, edited or deleted; the wizard is left without submitting.
// case-vs-ui (step 1): Xray "Add New" is the "+" button.
// case-vs-ui (step 2): Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui (step 3): the first of the two "Manage credentials" links (OS pair) is clicked; the dialog is titled "Credentials Management" and shows the
//   columns "Credentials" and "Description", the stored credentials, a "Learn more" link and a "Close" button.
// case-vs-ui (step 4): the dialog has no select-and-confirm action. It is closed with Close, and a stored credential is selected in the OS username drop-down of
//   the Options page: the username is filled and the (empty) OS password field becomes disabled (the stored password is used). Adding a credential in
//   the dialog is not exercised.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Credentials Management dialog lists stored credentials, closes with Close, and a stored credential applies to the OS username field',
  { tag: '@NJM-154567' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows, mssqlInstanceTarget: target }, testInfo) => {
    const obs = new ObsBFlows(page);

    await test.step('1. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens at the Platform step', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154567 step 1: Xray "Add New" is the "+" button.' });
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154567 step 2: Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile.' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Click the Manage credentials link; the Credentials Management dialog shows its credential list and controls', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154567 step 3: the dialog is "Credentials Management"; the first (OS) link is clicked.' });
      await page.getByText('Manage credentials', { exact: true }).filter({ visible: true }).first().click();
      const dialog = obs.credentialsDialog();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Credentials Management', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Credentials', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Description', { exact: true })).toBeVisible();
      await expect(dialog.getByText(target.osUsername, { exact: true }).first()).toBeVisible();
      await expect(dialog.getByText('Learn more', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Close', { exact: true })).toBeVisible();
    });

    await test.step('4. Select a stored credential and confirm; the dialog closes and the credential is applied to the OS username field', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154567 step 4: the dialog is closed with Close; the credential is selected in the OS username drop-down, which fills the username and disables the OS password field.' });
      await obs.credentialsDialog().getByText('Close', { exact: true }).click();
      await expect(obs.credentialsDialog()).toBeHidden();
      await obs.openUsernameDropdown(0);
      await obs.comboItem(target.osUsername).click();
      await expect(addInventoryItemPage.input('username', 0)).toHaveValue(target.osUsername);
      await expect(addInventoryItemPage.input('password', 0)).toBeDisabled();
      await wizardFlows.leave();
    });
  },
);
