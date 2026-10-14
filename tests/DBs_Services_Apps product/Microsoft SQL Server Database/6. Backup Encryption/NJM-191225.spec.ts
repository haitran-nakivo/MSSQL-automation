import { test, expect } from '../../../../fixtures';
import { RUN_OPTIONS } from '../../../../fixtures/run-options';
import { BkA7OptionsFlows } from '../../../../flows/bkA7-options.flows';
import { readA7Setup } from '../../../../helpers/bkA7-env';

// NJM-191225: "ENC-03 - Password field validation in Create password".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY.
// Side effects: the wizard is opened and cancelled. Attempts that the product ACCEPTS (it may allow short, special-character, unicode or spaced passwords) are saved by Director as passwords
//   with Description NJM-191225; afterEach deletes them through Manage passwords (the same throw-away wizard as the other encryption cases).
// case-vs-ui: the documented minimum / maximum password length and the Description limit are not in the case or the notes. Steps 1-3 (required / mismatch) are asserted (the dialog must stay open;
//   fields 1 and 2 must be marked invalid). Steps 4-8 and 10 attach what the product did as observed-outcome (accepted or blocked + the dialog text) because the expected result there depends on the spec.
//   Step 9 (eye icon) is asserted only when the icon is found (UNVERIFIED locator). Status PARTIAL.
test.use(RUN_OPTIONS);

const KEY = 'NJM-191225';
let saved = false;

test.afterEach(async ({ page, backupFlows }) => {
  const flows = new BkA7OptionsFlows(page, backupFlows);
  try {
    await flows.leaveWizard();
  } catch {
    // best effort
  }
  if (!saved) return;
  try {
    await flows.cleanupPasswords(readA7Setup(), KEY);
  } catch {
    // best effort
  }
  saved = false;
});

test(
  'NAKIVO validates the password fields of the Create password dialog and keeps the dialog open on invalid input',
  { tag: '@NJM-191225' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    const setup = readA7Setup();
    const flows = new BkA7OptionsFlows(page, backupFlows);
    const ui = flows.ui;
    const valid = 'Qa-Valid-Pw-1234!';

    // Types both fields (and the description), presses Proceed, reports what happened. When the dialog closed (the product accepted the value) it is reopened for the next attempt.
    const attempt = async (password: string, repeat: string, description = KEY) => {
      await flows.fillNewPassword({ password, repeat, description });
      await ui.proceedButton().click({ timeout: 10_000 });
      const closed = await flows.dialogClosed(ui.setPasswordDialog(), 4_000);
      let text = '';
      if (closed) {
        saved = true;
        await flows.openSetPassword();
      } else {
        text = await flows.dialogText(ui.setPasswordDialog());
      }
      return { closed, text };
    };
    const note = (label: string, r: { closed: boolean; text: string }) =>
      testInfo.annotations.push({ type: 'observed-outcome', description: `${label}: ${r.closed ? 'accepted (dialog closed)' : `blocked, dialog text: ${r.text}`}` });

    await test.step('Precondition: a new job at 4. Options with Backup encryption = Enabled and Set a password open on Create password', async () => {
      await flows.openOptionsStep(setup);
      await flows.enableBackupEncryption();
      await flows.openSetPassword();
      expect(await flows.isChecked(ui.createPasswordRadio())).toBe(true);
    });

    await test.step('1. Both fields empty, Proceed: blocked with a required-field mark', async () => {
      const r = await attempt('', '', '');
      note('empty/empty', r);
      expect(r.closed, 'Proceed accepted an empty password').toBe(false);
      expect(await flows.fieldInvalid(ui.passwordField()), 'the empty Password field is not marked invalid').toBe(true);
    });

    await test.step('2. A valid password in Password, Repeat empty, Proceed: blocked', async () => {
      const r = await attempt(valid, '');
      note('valid/empty', r);
      expect(r.closed, 'Proceed accepted a missing repeat').toBe(false);
      expect(await flows.fieldInvalid(ui.repeatPasswordField()), 'the empty Repeat field is not marked invalid').toBe(true);
      expect(await ui.passwordField().inputValue(), 'the entered password was lost').toBe(valid);
    });

    await test.step('3. Two different valid passwords (mismatch), Proceed: blocked and the entered values stay', async () => {
      const r = await attempt(valid, `${valid}-other`);
      note('mismatch', r);
      expect(r.closed, 'Proceed accepted mismatching passwords').toBe(false);
      expect(await ui.passwordField().inputValue()).toBe(valid);
      expect(await ui.repeatPasswordField().inputValue()).toBe(`${valid}-other`);
    });

    await test.step('4. A password below the documented minimum length (1 character) in both fields, Proceed', async () => {
      note('1 character', await attempt('a', 'a'));
    });

    await test.step('5. A password above the documented maximum length (1024 characters) in both fields, Proceed', async () => {
      const long = 'A1!'.repeat(342);
      const r = await attempt(long, long);
      note('1026 characters', r);
      if (!r.closed) expect(await ui.passwordField().inputValue()).not.toBe('');
    });

    await test.step('6. Special characters only in both fields, Proceed', async () => {
      const special = '!@#$%^&*()_+-=[]{};\'\\:"|,.<>/?';
      note('special characters', await attempt(special, special));
    });

    await test.step('7. Non-ASCII / unicode characters including an emoji in both fields, Proceed', async () => {
      const unicode = 'Pässwörd-日本語-\u{1F510}';
      note('unicode', await attempt(unicode, unicode));
    });

    await test.step('8. A password with leading and trailing spaces in both fields, Proceed', async () => {
      note('spaces', await attempt('  Qa-Spaced-1  ', '  Qa-Spaced-1  '));
    });

    await test.step('9. Click the eye icon in each password field: it reveals / masks only its own field', async () => {
      await flows.fillNewPassword({ password: valid, repeat: valid });
      const eyes = [ui.eyeIconAfter(ui.passwordField()), ui.eyeIconAfter(ui.repeatPasswordField())];
      if ((await eyes[0].count()) === 0) {
        testInfo.annotations.push({ type: 'observed-outcome', description: 'No eye icon located (UNVERIFIED locator); toggle not asserted.' });
        return;
      }
      expect(await ui.passwordField().getAttribute('type')).toBe('password');
      await eyes[0].click({ timeout: 10_000 });
      expect(await ui.passwordField().getAttribute('type'), 'the eye icon did not reveal the Password field').toBe('text');
      expect(await ui.repeatPasswordField().getAttribute('type'), 'the Password eye revealed the Repeat field too').toBe('password');
      expect(await ui.passwordField().inputValue()).toBe(valid);
      await eyes[0].click({ timeout: 10_000 });
      expect(await ui.passwordField().getAttribute('type')).toBe('password');
    });

    await test.step('10. A Description well beyond its limit (2000 characters) with a valid password, Proceed', async () => {
      const r = await attempt(valid, valid, `${KEY} ${'d'.repeat(2000)}`);
      note('2000-character description', r);
    });

    await test.step('11. Cancel the wizard', async () => {
      if (await ui.setPasswordDialog().isVisible()) await ui.cancelButton().click({ timeout: 10_000 });
      await flows.leaveWizard();
      await expect(backupFlows.wizard.title).toBeHidden();
    });
  },
);
