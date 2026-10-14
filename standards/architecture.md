# Layer architecture

Status: **DRAFT for owner review.** Date: 2026-10-02. Part of `standards/README.md`.

## 1. Layers and dependencies

```
tests/ ──▶ fixtures/ ──▶ pages/ ──▶ pages/components/
   │            │           │
   └────────────┴───────────┴──▶ helpers/
knowledge/ and standards/ are documents. No code depends on them.
```

Allowed imports (anything not listed is forbidden):

| Layer | May import |
|---|---|
| `tests/` | `fixtures/` (for `test` and `expect`), `pages/` (types), `helpers/` |
| `fixtures/` | `pages/`, `helpers/`, Playwright |
| `pages/` | `pages/components/`, `helpers/` (pure only), Playwright |
| `pages/components/` | `helpers/` (pure only), Playwright |
| `helpers/` | Node and Playwright types only |

A lower layer never imports a higher one. A page does not import another page. A component does not import a page. Shared behavior is shared by composition (a component), not by a base class. A common base class is not introduced.

## 2. Responsibilities

| Layer | Belongs here | Must not contain |
|---|---|---|
| `tests/` | Test intent expressed with the verbs of the page objects. Every business assertion (`expect`). Choice of test data. Titles and Xray tags. `test.step` for readability. One folder per approved area: `tests/authentication/`, `tests/activities/`, `tests/overview/`. | Selector strings or locator calls, hard-coded URLs, credentials, fixed waits, product logic, shared mutable state, conditions on the environment, calls to Jira |
| `pages/` | One class per screen. The screen's route (a relative path such as `/c/login`). Its locators, kept private. Action methods. Read-only `Locator` properties and state queries for what a test needs to check. Waits for the screen's own readiness (see `assertions-and-waits.md`). | `expect` on business outcomes, test data, credentials, `process.env`, Xray keys, `test` or `describe`, another page's internals |
| `pages/components/` | A UI structure with its own root `Locator`, used by composition (the same API style as a page). | URLs, page imports, assertions, Xray keys |
| `fixtures/` | `test.extend` modules that create page objects, supply the credentials through the helper, and perform the signed-in set-up. Lifecycle only. `fixtures/index.ts` is the one place that exports `test` and `expect`. | Business assertions, case-specific data or logic, locators, product-state changes |
| `helpers/` | Small pure functions (see section 4). | `Page` or `Locator` parameters, `expect`, product facts, imports from `tests/`, `pages/` or `fixtures/` |
| `knowledge/` | Verified product and UI facts with provenance. | Code, automation rules, run-time reading |
| `standards/` | Normative rules for the automation. | Product facts |

## 3. Components

A shared component is introduced when the same UI structure is used **twice**: on two screens, or twice on one screen. A single use stays in its page object. A component:

- takes its root `Locator` in its constructor, so every locator inside it is scoped to that root;
- has no route and no knowledge of other pages;
- navigates nothing by itself beyond the click it performs. The caller creates the next page object.

The knowledge already records structures that would qualify when a test needs them: the left sidebar and the Logout menu (every authenticated page), the Running and Past lists of the Activities screen (same columns), and the Events table on Overview. This is a note, not an instruction to create them.

## 4. Helper admission rule

`helpers/` is deliberately small. A function is admitted only if **all** of these hold:

1. It is pure or deterministic: the same inputs give the same output, with no browser, no product state and no hidden state. **The one exception** is the approved `.env` reader (P4-3), which by purpose reads the environment file (`fixtures-and-session.md`, section 3).
2. It has no `Page` or `Locator` parameter. Anything that touches the UI is a page object or a component.
3. It contains no assertion.
4. It holds no product knowledge (no UI texts, URLs, labels or business rules).
5. It has at least two callers, or a fixture uses it, or it is the approved `.env` reader (see `fixtures-and-session.md`).
6. It is named for the one thing it does, in a file of that name. There is no `utils.ts`, `common.ts`, `helpers.ts` or similar catch-all file.

Allowed kinds: reading and typing configuration from the environment, formatting or parsing values, building generic unique values, thin wrappers over Node APIs. When a function fits none of these, it goes elsewhere:

| It does this | It belongs in |
|---|---|
| Touches the UI | a page or a component |
| Manages test lifecycle or state | a fixture |
| Decides pass or fail | a test |
| Computes something pure | `helpers/` |
| Records a product fact | `knowledge/` (through its process) |
| Records a convention | `standards/` |

## 5. Test independence and creation on demand

1. Each test runs in its own browser context (Playwright's default) and does not depend on another test or on test order.
2. A layer file is created only when an approved test needs it, and only for coverage that already exists and is approved. The architecture creates no new functional coverage and no automation candidate.
3. Fixtures and tests do not change product state, other than signing in (`fixtures-and-session.md`, section 4). A fixture, helper or test that creates, removes or reconfigures anything in the Director needs a separate owner decision first.
4. The knowledge is the source of verified UI behavior. A page object or a test does not state a UI fact that the knowledge does not record (see `locators.md` and `assertions-and-waits.md`).

## 6. Existing files

`playwright.config.ts`, `tsconfig.json`, `package.json` and the three existing specs are not changed by these standards. The configuration stays free of environment reading. TypeScript imports are relative; no path alias is defined. The policy for the three specs is in `existing-specs.md`. The Director's base URL comes from `NAKIVO_BASE_URL` in `.env` through the fixtures (P6-1, `fixtures-and-session.md` section 3), not from the config.

## 7. Enforcing the boundaries (S4-7)

**No lint or boundary tool is required before the first implementation.** Not installing any package is an owner-approved constraint for this work; that no tool is needed yet is **Proposed**. The layers start small, so the rules are enforced by a **manual checklist**, run by the implementing agent before it reports and by the owner at review (Proposed):

1. No locator call, selector string or URL in `tests/`.
2. No `expect` in `pages/`, `pages/components/` or `helpers/`; in `fixtures/` only the fixture's own contract check.
3. No `process.env`, `.env` read or credential value outside the one reader helper; no credential in any title, tag, annotation, attachment or message.
4. No fixed wait (`waitForTimeout` or a sleep).
5. No import against the direction in section 1, no page importing a page, no component importing a page.
6. Every locator is on the verified list or in a recorded knowledge update (`locators.md`); no `ext-gen*`, `simpleIcon-*`, numbered id or class selector.
7. No Xray key outside `tests/`; no Jira call anywhere.
8. No file in `helpers/` that fails the admission rule (section 4); no catch-all file name.
9. No test that is not realized from already-approved existing coverage.

The checks may be assisted by read-only searches of the files. Nothing is installed or committed for them.

**When automated enforcement may become necessary (Proposed):** when a boundary violation is found in review; when the number of files makes manual review unreliable in the owner's judgment; or when more than one agent or person changes the layers in parallel. The owner then decides which tool and approves its installation. Note for that decision: `typescript` is not a dependency (only `@playwright/test` is), and Playwright runs TypeScript without type-checking it, so type errors would not be caught today.

## 8. Locale (S4-6)

1. **Initial assumption (Derived from `ui.locator-conventions`, Limits):** the product UI under test is in English. Every verified locator relies on English UI text, and other languages have not been examined. Tests may rely on English UI text for locators and for asserted text, and a page object records that a locator is language-dependent.
2. **No localization infrastructure (owner-approved constraint of Step 4):** no locale parameter, translation table, per-locale project or per-locale configuration is introduced. The browser locale is not configured by these standards.
3. **No multilingual claim (owner-approved constraint of Step 4):** nothing in the automation claims that the product works in another language, and a run against a UI in another language is not supported. Phase 3 found the localization cases unsuitable for automation, and this standard does not change that.
4. How the UI language is selected (an installer setting or a browser setting) is not recorded in the knowledge, so the standard assumes the lab instance as observed and says nothing more. Supporting another language needs evidence and an owner decision first.
