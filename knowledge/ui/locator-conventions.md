---
id: ui.locator-conventions
topic: locators
source: Live Director UI (lab instance recorded in PROJECT_STATUS.md), /c/login and /c/overview; corroborated by tests/nakivo-login.spec.ts and tests/nakivo-login-auth.spec.ts
source_type: live-ui
product: nakivo-backup-replication
area: cross-cutting
product_version: "11.3"
build: 11.3.0.112329
verified_on: 2026-10-01
how_verified: Element attributes were inspected on the live Director, and each locator listed as verified is used by a passing Playwright test (strict mode, exactly one match).
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: reviewed
relates_to: [ui.auth-session, ui.login, ui.overview]
---

# Locator conventions (current UI)

What was observed about the elements a test can target, and the one locator decision recorded for the project. Wider locator guidance is not recorded here; if it is adopted it belongs in `standards/`.

## Generated ids

The Director UI appears to be built with **Ext JS**: the `ext-gen` ids and `x-*` classes are Ext JS conventions. The ids observed have counter-style names:

- `ext-gen<number>`, such as the ids on the username field, password field, checkboxes and LOG IN button
- `simpleIcon-<number>`, such as the parents of the Overview and Logout items in the left sidebar
- other numbered ids on the Overview page, such as `tableView-<number>`, `tableActionHeader-<number>`, `genericSearchField-<number>`, `iconButton-<number>`, `base-button-<number>` and `simpleLink-<number>`
- `x-*` classes on many elements

These ids have not been compared across reloads.

**Recorded project decision** (`PROJECT_STATUS.md`): never use `ext-gen*` or `simpleIcon-*` ids as locators. No decision has been recorded for the other numbered ids or the `x-*` classes, which follow the same generated pattern.

## Verified locators

Each is used by a passing test, and each matched exactly one element (Playwright's strict mode requires this).

| Element | Locator | Used in |
|---|---|---|
| Username field | `page.getByPlaceholder('Username')` | login page test, authenticated test |
| Password field | `page.getByPlaceholder('Password')` | login page test, authenticated test |
| LOG IN button | `page.getByRole('button', { name: 'LOG IN' })` | login page test, authenticated test |
| Authenticated-state marker | `page.getByTitle('Logout')` | authenticated test |

## Attributes observed but not yet used in a test

- Username input: `name="username"`.
- Password input: `type="password"`. It has no `name` attribute.
- Both inputs expose `role="textbox"`; the LOG IN button exposes `role="button"`.

## data-testid

- None of the login-page controls inspected (inputs, checkboxes, button, labels, links) has a `data-testid`. The rest of the login page was not searched for them.
- On the Overview page, among the visible elements inspected, `data-testid` appeared only in the Events table: `event-table`, `event-table-header`, `event-table-header-search-field`, `event-table-header-filter-button`, and its `-button` and `-button-inner` children.
- `page.getByTestId('event-table')` matched exactly one element.

## Roles are not reliable everywhere

- Many elements carry `role="presentation"`, including the left-sidebar items, the page's links, and the **Contact Sales** button.
- The **Logout** control is not exposed as a link or a button: `getByRole('link', { name: 'Logout' })` and `getByRole('button', { name: 'Logout' })` each matched nothing.
- For that reason Logout is located by its `title` attribute, with `getByTitle('Logout')`.

## Limits

- Every verified locator relies on English UI text, and other languages have not been examined.
- Only the login page and the Overview page have been inspected, so this document does not yet cover other screens.
