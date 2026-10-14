import type { Locator, Page } from '@playwright/test';

// Login screen. Facts and verified locators: knowledge ui.login and ui.locator-conventions.
export class LoginPage {
  private static readonly route = '/c/login';

  readonly usernameField: Locator;
  readonly passwordField: Locator;
  readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.usernameField = page.getByPlaceholder('Username');
    this.passwordField = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: 'LOG IN' });
  }

  async goto(): Promise<void> {
    await this.page.goto(LoginPage.route);
  }

  async signIn(username: string, password: string): Promise<void> {
    await this.usernameField.fill(username);
    await this.passwordField.fill(password);
    await this.loginButton.click();
  }
}
