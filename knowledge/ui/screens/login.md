---
id: ui.login
topic: login-screen
source: Live Director UI (lab instance recorded in PROJECT_STATUS.md), path /c/login; corroborated by tests/nakivo-login.spec.ts
source_type: live-ui
product: nakivo-backup-replication
area: cross-cutting
product_version: "11.3"
build: 11.3.0.112329
verified_on: 2026-10-01
how_verified: Page structure and attributes were inspected on the live Director (not logged in). The title and the three controls are asserted by a passing Playwright test.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: reviewed
relates_to: [ui.auth-session, ui.locator-conventions, ui.overview]
---

# Login screen (current UI)

- **Path:** `/c/login`
- **Page title:** `NAKIVO Backup & Replication`

## Controls

| Control | Locator (verified) | Notes |
|---|---|---|
| Username field | `getByPlaceholder('Username')` | Text input, `name="username"`, placeholder "Username", marked required |
| Password field | `getByPlaceholder('Password')` | Password input, placeholder "Password", no `name` attribute |
| LOG IN button | `getByRole('button', { name: 'LOG IN' })` | Disabled while the form is empty (observed on the freshly loaded page). The authenticated test clicks it successfully after filling both fields. |
| Remember me | label "Remember me" | Checkbox, unchecked by default. Its effect is recorded in `ui.authentication-flows`. |

## Other elements on the page

- A link labeled **Forgot the password?**.
- A **Privacy policy** link.
- A **NAKIVO** link to the company website and a **support@nakivo.com** mail link. (Neither was followed.)
- A checkbox labeled **I agree to the** with an **End User License Agreement** link. Both are in the page but were **hidden** on this instance. When they appear is unknown.

## Page structure

- There is no `<form>` element and no iframe.
- None of the controls inspected (inputs, checkboxes, button, labels, links) has a `data-testid` attribute. The rest of the page was not searched for them.
- Control ids are generated (`ext-gen*` on the inputs, checkboxes and button) and, per the recorded project decision, are not used as locators.

## Behavior observed

- Loading the page (with certificate errors ignored) produced no console errors or warnings, no page errors, no failed requests and no HTTP errors.
- Signing in with valid credentials leaves this page and lands on `/c/overview` (see `ui.auth-session`).

## Verified by test

`tests/nakivo-login.spec.ts` asserts the page title and that the Username field, Password field and LOG IN button are visible. It types nothing and does not sign in.

## Not verified

The behavior of most links and of the hidden checkbox, and error messages for bad credentials. The rule that enables the button, submitting with Enter, the Remember me checkbox and the "Forgot the password?" view are recorded in `ui.authentication-flows`.
