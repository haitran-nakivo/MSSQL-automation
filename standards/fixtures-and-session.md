# Fixture and session policy

Status: **DRAFT for owner review.** Date: 2026-10-02. Part of `standards/README.md`. Based on the Phase 4 decisions on credentials and authentication/session.

## 1. Fixtures

1. A fixture manages **lifecycle and reusable state**: it creates page objects, supplies configuration, and performs set-up. It contains no business assertion and no case-specific data or logic.
2. Fixtures are **test-scoped**, so each test keeps its own fresh browser context and is isolated from the others. A worker-scoped fixture is allowed only for a read-only value that does not touch the browser or the product.
3. Fixtures live in `fixtures/`. `fixtures/index.ts` is the only module that exports `test` and `expect` for the tests; other fixture modules are composed into it.
4. A fixture does not change product state (create, remove or reconfigure anything in the Director), other than signing in (section 4). Any other change needs a separate owner decision.
5. A fixture's contract check follows `assertions-and-waits.md`, section 1, point 2, and is limited to the fixture's own contract. Its failure message names the fixture and never contains a secret value.

## 2. Session strategy for the initial implementation

1. **UI login per test.** The signed-in fixture signs in through the login screen in each test, using the verified login sequence (`ui.auth-session`).
2. **Not used in this phase:** `storageState`, a setup project, a global setup, a shared cookie or state file, or any authentication cache. Sessions are not shared between tests.
3. **The signed-in fixture's contract** is: the test receives a page that is signed in as the configured user. Its check is limited to the recorded authenticated-state marker (`getByTitle('Logout')` visible, `ui.auth-session`, Authenticated-state markers).
4. **The login test does not use the signed-in fixture.** A test whose subject is signing in, the login form, or the unauthenticated state uses the plain page-object fixtures, so that the thing under test is not already done by set-up.
5. No sign-out is performed in fixture teardown by default. The browser context is discarded after each test. Signing out is the subject of tests of its own, not a clean-up step.
6. Changing any of points 1 and 2 needs a recorded owner decision.

## 3. Credentials

1. Credentials come only from the local, gitignored `.env`, with the recorded variable names `NAKIVO_USERNAME` and `NAKIVO_PASSWORD`. They are never hard-coded, never written into any tracked file, and never printed.
2. When implementation starts, a **small typed reader helper** in `helpers/` is the only code that reads them. It loads `.env` with the recorded mechanism (`process.loadEnvFile`), returns a typed object, and throws a clear error if a variable is missing. The error names the **variable**, never a value. Where it reads `.env` from is fixed in point 7.
3. Fixtures call the reader and pass the values to the page object's sign-in method as arguments. Tests, page objects and components do not read the environment.
4. Credential values never appear in log output, `test.step` titles, tag or annotation values, attachments, or error messages.
5. `playwright.config.ts` stays free of environment reading. This step changes no runtime or configuration behavior.
6. A trace records typed values, including the password (recorded decision). `artifacts/` and `playwright-report/` are not shared.
7. **Where `.env` is read from (S4-10, Owner-approved 2026-10-02).**
   - The helper reads exactly one file, `.env` at the **repository root**, the directory that holds `playwright.config.ts` and `package.json`.
   - It finds that path from **its own file location** (the repository root is the parent of `helpers/`), not from the current working directory. The rule therefore gives the same file whichever directory the tests are started from. This replaces the recorded "run from the repo root" caveat for the future helper only; the existing specs keep their own `process.loadEnvFile('.env')` until they are migrated (`existing-specs.md`).
   - It passes that explicit path to `process.loadEnvFile`. There is no search of parent directories, no fallback location, no second file (no `.env.local` or `.env.*`), and no extra package.
   - If the file or a variable is missing, the error names the file as `.env` at the repository root and the missing variable names, nothing else.
   - `.env` stays gitignored (it already is). No example file with values is created; any other source of credentials, such as CI, is not part of this rule and needs its own owner decision.
8. **Base URL (P6-1, Owner-approved 2026-10-02).** The Director under test is set by `NAKIVO_BASE_URL` in the same `.env`, read by the same reader helper (`readBaseUrl()`), together with the credentials. It is required and has no silent default: a missing, invalid or non-http(s) value stops the test with an error that names the variable and never shows the value of any secret. The `fixtures/index.ts` fixture overrides Playwright's `baseURL` with it, so the specs and page objects keep using relative paths. `playwright.config.ts` stays free of environment reading; its own `baseURL` is no longer what the fixture-based tests use. One `.env` file means one Director per run: no profile files and no multi-project setup.

## 4. State-changing fixtures and API checks (S4-8)

**Currently allowed in a fixture (S4-8a, Owner-approved 2026-10-02):**
- creating page objects, and supplying configuration and the credentials through the helper;
- signing in through the UI, which creates a session and nothing else that the test did not ask for.

**Requires a separate owner decision before any fixture, helper or test does it (Derived from the Step 3 standard; the examples are Proposed):** anything that creates, edits, removes, starts, stops, restarts, restores or reconfigures something in the Director. That covers jobs, activities, inventory, users and permissions, settings, tenants and two-factor settings; injecting faults; producing large data volumes; restarting the product; and attempts that Phase 3 recorded as affecting shared state (for example repeated wrong-credential attempts, which the case text ties to a per-address counter; unverified). A request for such a decision states the side-effect class (as in the Phase 3 rubric, criterion C4), how it is reversed, how it is isolated from the shared lab, and which approved existing coverage needs it.

**API-level checks (S4-8, Proposed): out of the initial automation architecture.** The initial architecture is UI-level. There is no `api/` layer, no API client, and no HTTP call to the product or to Jira from any of the five code layers. API-level checks remain an open item of the project (`PROJECT_STATUS.md`, section 5) and would need their own owner decision and a change to these standards before any design.

Nothing in this section implements a client or a fixture.
