import { test, expect } from '../../../../fixtures';
import { RUN_OPTIONS } from '../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../flows/bkA7-options.flows';
import { readA7Setup } from '../../../../helpers/bkA7-env';

// NJM-191224: "ENC-02 - Enabling encryption opens Set a password with correct defaults".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY. Precondition of the case: the Key Management Service is disabled (Settings > General >
//   System Settings > Encryption, "Use AWS Key Management Service" unchecked); it is confirmed by the warning the dialog shows.
// Side effects: none (the wizard is opened and cancelled; nothing is saved to Manage passwords).
// case-vs-ui: all dialog locators are UNVERIFIED (the dialog was explored only partly; texts "Select password", "Create password", "Manage passwords", "Proceed", "Cancel" and the warning text are from the notes).
//   Both saved-password states of the case are covered by one branch: whether saved passwords exist is read from the Manage passwords list, and Select password must be disabled exactly when there are none.
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try {
    await new BkA7OptionsFlows(page, backupFlows).leaveWizard();
  } catch {
    // best effort
  }
});

test(
  'NAKIVO opens Set a password with Create password preselected and empty fields when Backup encryption is enabled',
  { tag: '@NJM-191224' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(600_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    let selectEnabled = false;
    let savedCount = 0;

    await test.step('1. Start a new backup job and reach 4. Options', async () => {
      await flows.openOptionsStep(setup);
      await expect(flows.ui.optionLabel('Backup encryption')).toBeVisible();
    });

    await test.step('2. Set Backup encryption = Enabled: a settings link appears next to it', async () => {
      await flows.enableBackupEncryption();
      expect(await flows.comboValue('Backup encryption')).toBe('Enabled');
      await expect(flows.ui.encryptionSettingsLink()).toBeVisible();
    });

    await test.step('3. Observe the Network acceleration row: it is greyed out (control disabled)', async () => {
      expect(await flows.isDisabled(backupFlows.wizard.optionInput('Network acceleration'))).toBe(true);
    });

    await test.step('4. Click the settings link: the Set a password dialog opens', async () => {
      await flows.openSetPassword();
      await expect(flows.ui.setPasswordDialog()).toBeVisible();
    });

    await test.step('5. Inspect the dialog: Create password preselected, empty fields, Select password state, warning, buttons', async () => {
      expect(await flows.isChecked(flows.ui.createPasswordRadio()), 'Create password is not preselected').toBe(true);
      expect(await flows.ui.passwordField().inputValue()).toBe('');
      expect(await flows.ui.repeatPasswordField().inputValue()).toBe('');
      expect(await flows.ui.descriptionField().inputValue()).toBe('');
      selectEnabled = !(await flows.isDisabled(flows.ui.selectPasswordCombo()));
      testInfo.annotations.push({ type: 'observed-outcome', description: `Select password dropdown enabled: ${selectEnabled}` });
      await expect(flows.ui.kmsWarning()).toBeVisible();
      await expect(flows.ui.encryptionTabLink()).toBeVisible();
      await expect(flows.ui.proceedButton()).toBeVisible();
      await expect(flows.ui.cancelButton()).toBeVisible();
    });

    await test.step('6. Click Manage passwords, review the list, close it', async () => {
      await flows.openManagePasswords();
      await expect(flows.ui.managePasswordsDialog().locator('input[placeholder*="Search" i]').first()).toBeVisible();
      await expect(flows.ui.addPasswordButton()).toBeVisible();
      savedCount = (await flows.managePasswordRowTexts()).length;
      testInfo.annotations.push({ type: 'observed-outcome', description: `Saved passwords listed: ${savedCount}` });
      await flows.closeManagePasswords();
      // Select password and its dropdown are disabled exactly when no saved password exists.
      expect(selectEnabled, 'Select password state does not match the saved passwords list').toBe(savedCount > 0);
    });

    await test.step('7. Close Set a password with Cancel, reopen via settings and close with the x: Backup encryption stays Enabled and nothing is added', async () => {
      await flows.ui.cancelButton().click({ timeout: 10_000 });
      await expect(flows.ui.setPasswordDialog()).toBeHidden();
      expect(await flows.comboValue('Backup encryption')).toBe('Enabled');
      await flows.openSetPassword();
      await flows.ui.closeTool().click({ timeout: 10_000 });
      await expect(flows.ui.setPasswordDialog()).toBeHidden();
      expect(await flows.comboValue('Backup encryption')).toBe('Enabled');
      await flows.openSetPassword();
      await flows.openManagePasswords();
      expect((await flows.managePasswordRowTexts()).length, 'a password was added although the dialog was cancelled').toBe(savedCount);
      await flows.closeManagePasswords();
      await flows.ui.cancelButton().click({ timeout: 10_000 });
    });

    await test.step('8. Cancel the wizard', async () => {
      await flows.leaveWizard();
      await expect(backupFlows.wizard.title).toBeHidden();
    });
  },
);
