import type { Locator, Page } from '@playwright/test';

// Overview screen, the page shown after sign-in. Only the authenticated-state marker is held here.
// Facts and verified locator: knowledge ui.overview, ui.auth-session and ui.locator-conventions.
export class OverviewPage {
  readonly logoutMarker: Locator;

  constructor(page: Page) {
    this.logoutMarker = page.getByTitle('Logout');
  }
}
