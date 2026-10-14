import { test, expect } from '../../../../fixtures';

test('NAKIVO login page shows the login form', async ({ page, loginPage }) => {
  await loginPage.goto();

  await expect(page).toHaveTitle('NAKIVO Backup & Replication');
  await expect(loginPage.usernameField).toBeVisible();
  await expect(loginPage.passwordField).toBeVisible();
  await expect(loginPage.loginButton).toBeVisible();
});
