# Naming, file structure and Xray traceability

Status: **DRAFT for owner review.** Date: 2026-10-02. Part of `standards/README.md`. The conventions come from the Step 2 design accepted on 2026-10-02 and are kept simple and consistent with the existing project (kebab-case spec file names, `*.spec.ts`, `testDir: ./tests`).

## 1. Naming and structure

| Item | Convention | Example (illustration only; none is created) |
|---|---|---|
| Test files | `tests/<area>/<topic>.spec.ts`, kebab-case. `<area>` is one of `authentication`, `activities`, `overview`. | `tests/authentication/login-form.spec.ts` |
| Page files and classes | `pages/<screen>.page.ts`; class `<Screen>Page` in PascalCase; one class per file | `pages/login.page.ts`, `LoginPage` |
| Component files and classes | `pages/components/<name>.component.ts`; class `<Name>Component` | `pages/components/sidebar.component.ts`, `SidebarComponent` |
| Fixture files | `fixtures/index.ts` (exports `test` and `expect`); other modules `fixtures/<topic>.fixture.ts` | `fixtures/signed-in.fixture.ts` |
| Helper files | `helpers/<one-concern>.ts`, named for the one thing it does; no catch-all name (`architecture.md`, section 4) | `helpers/credentials.ts` |
| Test titles | One sentence that starts with the subject and states the observable behavior, in the style of the existing specs. No Xray key, no step number, no secret value. | "NAKIVO login page shows the login form" |
| Directories | `tests/`, `pages/`, `pages/components/`, `fixtures/`, `helpers/` at the repository root | |

The three existing specs keep their names and places. Nothing here renames or moves them.

## 2. Xray traceability

1. **The Xray test case key is the stable identifier**, written exactly as in Jira (for example `NJM-98473`).
2. **Where it is stored (owner-approved, P4-9):** only in `tests/`, as a Playwright tag in the test details, `tag: ['@NJM-<number>']`. No separate Playwright annotation is required, and none is defined. A test that realizes more than one case lists each key as its own tag. A test with no Xray case has none. No other tag prefix is defined by these standards.
3. **Where it is not stored:** not in page objects, components, fixtures or helpers, not in test titles, and not in code comments of those layers.
4. **Derived mapping information** (a table of keys, tests and coverage notes) lives under `workspace/`, suggested `workspace/phase4/`. It is derived, never authoritative, and holds no credentials. A later tool may build it from the tags; such a tool is outside the five code layers and needs its own decision.
5. **A tag records origin, not authority or completeness.** Xray case content is T4 (needs review), and an assertion must be supported by existing knowledge or evidence (`assertions-and-waits.md`). A tag does not say that a case's every statement is covered. Statement ids from the Phase 3 analysis files are not used in code.
6. **No Jira write-back.** No code in `tests/`, `pages/`, `pages/components/`, `fixtures/` or `helpers/` reads from or writes to Jira (no API call, no result upload, no change of a field such as Automation scope). Reporting results to Xray, if ever wanted, is a separate owner decision.
7. Xray traceability stays out of the page-object design: a page object is written for the screen and is the same whether or not a test is tied to a case.
