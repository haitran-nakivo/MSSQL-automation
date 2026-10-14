---
id: ui.auth-session
topic: authentication-and-session
source: Live Director UI (lab instance recorded in PROJECT_STATUS.md), paths /c/login and /c/overview; corroborated by tests/nakivo-login.spec.ts and tests/nakivo-login-auth.spec.ts
source_type: live-ui
product: nakivo-backup-replication
area: cross-cutting
product_version: "11.3"
build: 11.3.0.112329
verified_on: 2026-10-01
how_verified: Observed on the live Director during Phase 0 exploration, and confirmed by the two passing Playwright login tests on 2026-10-01.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: reviewed
relates_to: [ui.login, ui.overview, ui.locator-conventions]
---

# Authentication and session behavior (current UI)

What the live Director does when an unauthenticated visitor arrives and signs in. Only facts observed so far are recorded; the gaps are listed at the end.

## Entry points

- Opening the Director's plain-HTTP address leads an unauthenticated visitor to **`/c/login`**, served over HTTPS on **port 4443** (HTTP 200). The redirect mechanism was not examined.
- `/c/login` can be opened directly. The tests do this through the configured base URL.
- After a successful login the browser lands on **`/c/overview`**.

## Certificate

- The Director presents a certificate that Chromium does not trust. The issuer was not inspected, so whether it is self-signed or issued by an internal authority is unknown.
- Without ignoring certificate errors, Chromium aborts the navigation with `net::ERR_CERT_AUTHORITY_INVALID`.
- This project sets `ignoreHTTPSErrors: true` in `playwright.config.ts`.
- After that, loading the login page produced no console errors or warnings, no page errors, no failed requests and no HTTP 4xx/5xx responses.

## Login sequence

1. Open `/c/login`. The page title is `NAKIVO Backup & Replication`.
2. Fill the Username and Password fields (see `ui.login` for the controls).
3. Click **LOG IN**.
   - The button was disabled while the form was empty (observed on the freshly loaded page).
   - The authenticated test fills both fields and then clicks it successfully; Playwright waits for a button to be enabled before clicking. The rule that enables it is recorded in `ui.authentication-flows`.
4. The login form disappears, the URL path changes to `/c/overview`, and the page title becomes `NAKIVO Backup & Replication v11.3.0.112329` (the build number is appended).

## Authenticated-state markers

All of these held after a successful login:

- The URL no longer matches `/c/login`.
- The Username field, Password field and LOG IN button are hidden.
- The **Logout** control in the left sidebar is visible, found with `getByTitle('Logout')`.

The project uses **Logout** as its authenticated-state marker because it is specific to the authenticated Overview page; it was not among the controls inspected on the login page. The locator choice is explained in `ui.locator-conventions`.

## Waiting behavior

- The authenticated test needed no explicit waits. Playwright's auto-waiting assertions were enough.
- The whole authenticated test ran in about 3 seconds in the passing runs.

## Session handling in this project

- The project's Playwright configuration reuses no stored login state (no storage state or global setup), and Playwright gives each test a fresh browser context. The authenticated test therefore logs in itself.
- Test credentials come from the gitignored `.env` file. They are never recorded in the knowledge base.

## Not verified

- Session expiry, idle timeout, and what happens on expiry.
- Behavior with wrong credentials or account lockout.
- The effect of Remember me, the sign-out flow and opening protected paths without a session are recorded in `ui.authentication-flows`.
- The hidden "I agree to the" checkbox and End User License Agreement link: they exist on the page but were not visible on this instance, and when they appear is unknown.
- Differences by user role or permissions, two-factor authentication, and behavior in other builds or locales.
