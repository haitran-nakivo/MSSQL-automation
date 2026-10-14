---
id: ui.authentication-flows
topic: authentication-flows
source: Live Director UI (lab instance recorded in PROJECT_STATUS.md), paths /c/login, /c/overview, /c/activities and /c/main
source_type: live-ui
product: nakivo-backup-replication
area: cross-cutting
product_version: "11.3"
build: 11.3.0.112329
verified_on: 2026-10-01
how_verified: Observed on the live Director with the test account, each scenario in a fresh browser context. Interactions were limited to opening protected paths without a session, typing in the login form without submitting, signing in and out, reloading, opening a second tab, going Back, signing in with and without Remember me, inspecting cookie attributes (names, flags and lifetimes only, never values), and opening the Forgot-password view without submitting. No wrong credentials were entered.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: reviewed
relates_to: [ui.auth-session, ui.login, ui.overview]
---

# Authentication flows (current UI)

Login form rules, sign-out, access without a session, session persistence and Remember me. This document extends `ui.auth-session`, which holds the basic login sequence, the certificate behavior and the authenticated-state markers. Each behavior below names its evidence by letter. Lab-specific values (host, account and user names) and all cookie values are omitted.

## Evidence key

| Letter | What was done |
|---|---|
| A | A protected path was opened in a fresh browser context with no session. |
| B | The login page was loaded, the focused field was read, and text was typed into the fields while the LOG IN state was read. Nothing was submitted. |
| C | Signed in with the test account by pressing Enter in the Password field. |
| D | After signing in: the page was reloaded, a second tab was opened in the same browser context, and `/c/login` was opened. |
| E | Sign-out: the sidebar Logout item was clicked, then Log out, then Back and direct paths were tried. |
| F | Cookie attributes were read after signing in (name, path, HttpOnly, Secure, SameSite, lifetime). |
| G | Signed in with Remember me checked and unchecked, and the cookies were compared. |
| H | Browser restart was simulated: a new browser context was given only the persistent cookies and a protected path was opened. |
| I | "Forgot the password?" was clicked. Nothing was submitted. |

## Access without a session

| Behavior | Evidence |
|---|---|
| Opening `/c/overview`, `/c/activities` or `/` in a fresh browser context, with no session, ends on `/c/login` with the login form visible. | A |

## Login form rules

| Behavior | Evidence |
|---|---|
| On load, the Username field has focus. | B |
| **LOG IN** is disabled while both fields are empty and while only the Password field has text. It becomes enabled as soon as the Username field has text, whether or not the Password field has text (checked with one character). | B |
| Pressing Enter in the Password field, with both fields filled with valid credentials, signs in and lands on `/c/overview`. | C |

## "Forgot the password?" view

| Behavior | Evidence |
|---|---|
| Clicking the link keeps the URL at `/c/login` and replaces the login form with a view that has a text input with the placeholder "Enter your username or email", underlined text reading "Forgot the username or email?", and a **DONE** button that is disabled at first. | I |

## Session persistence while signed in

| Behavior | Evidence |
|---|---|
| Reloading an authenticated page keeps the session (still on `/c/overview`, the Logout item visible). | D |
| A second tab in the same browser context, opened on `/c/activities`, is signed in. | D |
| Opening `/c/login` while signed in ends on `/c/main`, still signed in (the Logout item visible). What `/c/main` is was not examined. | D |

## Session cookie

Names are shown with the numeric suffix replaced by `<n>`.

| Cookie | Observed attributes | Evidence |
|---|---|---|
| `JSESSIONID-<n>` | HttpOnly, Secure, SameSite=Strict, session cookie (no expiry) | F |

Other cookies and local-storage entries were present after sign-in. Their origin and purpose were not examined, so they are not described here.

## Remember me

| Behavior | Evidence |
|---|---|
| Signing in with **Remember me** checked adds a cookie `remember-me-<n>` (HttpOnly, Secure) that is persistent, with a lifetime of about 336 hours (14 days) from sign-in. Without Remember me, that cookie is absent. | G |
| After a simulated browser restart (only persistent cookies kept, the session cookie dropped), opening `/c/overview` ends signed in, on `/c/main`, and a new session cookie appears. The same procedure after a sign-in without Remember me ends on `/c/login`. | H |
| After signing in with Remember me and then signing out, the `remember-me-<n>` cookie is gone. | E, G |

## Sign-out

| Behavior | Evidence |
|---|---|
| Clicking the sidebar **Logout** item does not sign out. It opens a small menu above the item with the user's name, a **Profile** link and a **Log out** link, and the page stays on `/c/overview`. | E |
| Clicking **Log out** signs out: the browser lands on `/c/login`, the title is `NAKIVO Backup & Replication`, the login form is visible and the Logout item is gone. No confirmation text was found in the page half a second after the click. | E |
| After signing out, in the same browser context: Back ends on `/c/login`, and opening `/c/overview` or `/c/activities` ends on `/c/login`. | E |
| A `JSESSIONID-<n>` cookie is still present after sign-out, but the Director no longer treats the session as signed in (protected paths redirect to the login page). | E |

## Not verified

- **Wrong credentials:** error messages, attempt limits and account lockout. Wrong credentials were deliberately not entered on the shared test account.
- Whether the Director accepts a sign-in with an empty Password field (the button is enabled with only a Username, but nothing was submitted that way).
- **Session expiry and idle timeout.** A local-storage entry named `userLastActiveTimestamp` exists, but its purpose was not examined.
- Whether the session identifier changes at sign-in or sign-out.
- Concurrent sessions for one account, and whether signing out in one tab affects others.
- Whether signing in returns to the originally requested path.
- What the **Profile** link opens, and what **DONE** in the Forgot-password view does.
- The hidden "I agree to the" checkbox, two-factor authentication, single sign-on, role differences, other builds and other languages.
