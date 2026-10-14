import { test, expect } from '../../../../fixtures';

test('NAKIVO user can log in with valid credentials', async ({ page, loginPage, overviewPage, credentials }) => {
  await loginPage.goto();
  await loginPage.signIn(credentials.username, credentials.password);

  await expect(page).not.toHaveURL(/\/c\/login/);
  await expect(loginPage.usernameField).toBeHidden();
  await expect(loginPage.passwordField).toBeHidden();
  await expect(loginPage.loginButton).toBeHidden();
  await expect(overviewPage.logoutMarker).toBeVisible();

  await page.pause(); // TEMPORARY: keeps Chrome open for manual inspection; remove only when the owner says so
});
