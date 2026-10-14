# Phase 5 migration: assertion-equivalence record

Status: **written before the originals were replaced** (rule S4-3d, owner-approved 2026-10-02). Derived working material in `workspace/`, not knowledge. Scope: exactly `tests/nakivo-login.spec.ts` and `tests/nakivo-login-auth.spec.ts`. `tests/smoke.spec.ts` is not part of the migration.

Approved rules applied: S4-2 (migrate, behavior-preserving, no new coverage), S4-3a (no change of functional coverage), S4-3b (only locators recorded as verified in the knowledge), S4-3c (same file path and test title), S4-3d (this record), S4-3e (run only the migrated tests), S4-3g (knowledge citations only after the tests pass; `verified_on` only after real re-verification), S4-10 (`.env` read from `<repository root>/.env`, found from the helper's own location, no search, no fallback), S4-8a and S4-8b (fixtures only create page objects, supply configuration and credentials, and sign in through the UI).

## 1. Original implementation (verbatim, kept here because the specs were never committed)

`tests/nakivo-login.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('NAKIVO login page shows the login form', async ({ page }) => {
  await page.goto('/c/login');

  await expect(page).toHaveTitle('NAKIVO Backup & Replication');
  await expect(page.getByPlaceholder('Username')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'LOG IN' })).toBeVisible();
});
```

`tests/nakivo-login-auth.spec.ts`

```ts
import { test, expect } from '@playwright/test';

process.loadEnvFile('.env');

test('NAKIVO user can log in with valid credentials', async ({ page }) => {
  const username = process.env.NAKIVO_USERNAME;
  const password = process.env.NAKIVO_PASSWORD;
  expect(username, 'NAKIVO_USERNAME is not set').toBeTruthy();
  expect(password, 'NAKIVO_PASSWORD is not set').toBeTruthy();

  await page.goto('/c/login');

  await page.getByPlaceholder('Username').fill(username!);
  await page.getByPlaceholder('Password').fill(password!);
  await page.getByRole('button', { name: 'LOG IN' }).click();

  await expect(page).not.toHaveURL(/\/c\/login/);
  await expect(page.getByPlaceholder('Username')).toBeHidden();
  await expect(page.getByPlaceholder('Password')).toBeHidden();
  await expect(page.getByRole('button', { name: 'LOG IN' })).toBeHidden();
  await expect(page.getByTitle('Logout')).toBeVisible();
});
```

## 2. Locators: all already recorded as verified (S4-3b)

| Locator | Used for | Recorded as verified in |
|---|---|---|
| `getByPlaceholder('Username')` | Username field | `ui.locator-conventions` (Verified locators), `ui.login` (Controls) |
| `getByPlaceholder('Password')` | Password field | same |
| `getByRole('button', { name: 'LOG IN' })` | LOG IN button | same |
| `getByTitle('Logout')` | authenticated-state marker | `ui.locator-conventions`, `ui.auth-session` (Authenticated-state markers) |

No other locator is used. No locator follow-up item arises.

## 3. Equivalence table

Migrated layout (new files): `helpers/credentials.ts` (the `.env` reader), `pages/login.page.ts` (`LoginPage`), `pages/overview.page.ts` (`OverviewPage`, holding only the Logout marker), `fixtures/index.ts` (exports `test` and `expect`; creates the page objects and supplies the credentials). The two specs keep their paths and titles.

### 3.1 `tests/nakivo-login.spec.ts` (title unchanged: "NAKIVO login page shows the login form")

| # | Original | Migrated | Preserved |
|---|---|---|---|
| A1 | `page.goto('/c/login')` | `loginPage.goto()` runs `page.goto('/c/login')` | yes, same path and base URL |
| A2 | `expect(page).toHaveTitle('NAKIVO Backup & Replication')` | the same line, in the test | yes |
| A3 | `expect(getByPlaceholder('Username')).toBeVisible()` | `expect(loginPage.usernameField).toBeVisible()`, the locator being the same one | yes |
| A4 | `expect(getByPlaceholder('Password')).toBeVisible()` | `expect(loginPage.passwordField).toBeVisible()` | yes |
| A5 | `expect(getByRole('button', { name: 'LOG IN' })).toBeVisible()` | `expect(loginPage.loginButton).toBeVisible()` | yes |

Assertions: 4 before, 4 after. Typing and signing in: none before, none after.

### 3.2 `tests/nakivo-login-auth.spec.ts` (title unchanged: "NAKIVO user can log in with valid credentials")

| # | Original | Migrated | Preserved |
|---|---|---|---|
| B1 | `process.loadEnvFile('.env')` at import (relative to the working directory) | the reader loads `<repository root>/.env`, found from `helpers/credentials.ts`, when the `credentials` fixture is created (S4-10) | yes when started from the repository root; the file location is now independent of the working directory (approved change) |
| B2 | `expect(username, 'NAKIVO_USERNAME is not set').toBeTruthy()` and the same for the password (a precondition, not a product assertion) | the reader throws an error that names the missing variable(s) and never a value; it runs before the test body | outcome preserved: the test fails before any navigation if a variable is missing or empty; the message wording differs and names the variables |
| B3 | `page.goto('/c/login')` | `loginPage.goto()` | yes |
| B4 | fill Username with the username | `loginPage.signIn(username, password)` fills Username first | yes, same order |
| B5 | fill Password with the password | `signIn` fills Password second | yes |
| B6 | click the LOG IN button | `signIn` clicks LOG IN last | yes |
| B7 | `expect(page).not.toHaveURL(/\/c\/login/)` | the same line, in the test | yes |
| B8 | `expect(Username).toBeHidden()` | `expect(loginPage.usernameField).toBeHidden()` | yes |
| B9 | `expect(Password).toBeHidden()` | `expect(loginPage.passwordField).toBeHidden()` | yes |
| B10 | `expect(LOG IN button).toBeHidden()` | `expect(loginPage.loginButton).toBeHidden()` | yes |
| B11 | `expect(getByTitle('Logout')).toBeVisible()` | `expect(overviewPage.logoutMarker).toBeVisible()` | yes |

Product assertions: 5 before, 5 after. The two precondition checks of B2 move from `expect` calls in the test to the reader.

## 4. What did not change

- No new assertion, no new test, no new behavior, no new locator. The sign-in sequence (open, fill Username, fill Password, click) and the order of the assertions are as before.
- No `storageState`, setup project, authentication cache, API check, state-changing fixture or package. `playwright.config.ts`, `package.json` and `tsconfig.json` are not changed.
- The credentials are read only by the reader and handed to `signIn` as arguments. They are not logged and not in any title, tag, annotation or message.
- No Xray tag is added (the specs carried none).

## 5. Intentional differences (all approved)

1. The `.env` file is found from the helper's location, not the working directory (S4-10).
2. The environment precondition is a thrown error from the reader and not an `expect` in the test (helpers do not assert, fixtures hold no business assertions; the outcome is the same).
3. The credentials are loaded when the fixture is created and not at module import.

## 6. Migrated implementation

Files created: `helpers/credentials.ts`, `pages/login.page.ts`, `pages/overview.page.ts`, `fixtures/index.ts`. Files replaced in place: `tests/nakivo-login.spec.ts`, `tests/nakivo-login-auth.spec.ts`. The migrated tests use the fixtures `page`, `loginPage`, `overviewPage` and `credentials`.

## 7. Results (2026-10-02)

- Command: only the two migrated specs (`playwright test tests/nakivo-login.spec.ts tests/nakivo-login-auth.spec.ts`).
- Result: **2 passed** (login form test 1.4 s; sign-in test 2.9 s; total 3.6 s). No other test was run.
- Equivalence: every row of section 3 is preserved; the three intentional differences of section 5 are as listed.
- Knowledge: no citation became inaccurate, so no knowledge document was changed; `verified_on` unchanged (see `standards/existing-specs.md` section 6).
- Locator follow-up: none; all four locators were already recorded as verified.
- `smoke.spec.ts`, `playwright.config.ts`, `package.json`, `package-lock.json`, `tsconfig.json` and the knowledge documents were not touched; no package was installed.
