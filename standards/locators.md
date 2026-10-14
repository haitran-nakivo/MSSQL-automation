# Locator policy

Status: **DRAFT for owner review.** Date: 2026-10-02. Part of `standards/README.md`. Sections 1 to 3 restate the locator decisions already recorded in `PROJECT_STATUS.md` section 6 and `ui.locator-conventions`. Section 2 (point 2), section 4 and section 5 were extended in Phase 4 Step 4; the status of each rule is in `decisions.md` (S4-4 and S4-5) and is marked below.

## 1. Approved strategies

The recorded decision prefers these strategies, and the verified locators are:

| Element | Locator | Recorded in |
|---|---|---|
| Username field | `getByPlaceholder('Username')` | `ui.locator-conventions`, `ui.login` |
| Password field | `getByPlaceholder('Password')` | same |
| LOG IN button | `getByRole('button', { name: 'LOG IN' })` | same |
| Authenticated-state marker | `getByTitle('Logout')` | `ui.locator-conventions`, `ui.auth-session` |
| Events table (Overview) | `getByTestId('event-table')`, where the knowledge records `data-testid` for that element | `ui.locator-conventions` |

The decision names placeholder, role with accessible name, and title as preferred, and it does not rank them. These standards do not rank them either. For each element the strategy is the one the knowledge records as verified for that element. `getByTestId` is used only where the knowledge records a `data-testid` for that element.

## 2. Prohibitions

1. **Never** use the generated ids `ext-gen*` or `simpleIcon-*` (recorded decision).
2. **Not approved as locators (S4-5, Derived from P4-6 and from the recorded rule in `ui.overview` that classes are not used as locators; owner confirmation requested):**
   - the other numbered ids (for example `tableView-*`, `tableActionHeader-*`, `genericSearchField-*`, `iconButton-*`, `base-button-*`, `simpleLink-*`), which follow the same generated pattern as the prohibited ids and were not compared across reloads (`ui.locator-conventions`);
   - the `x-*` classes;
   - any other CSS class (for example the application classes recorded in `ui.activities-elements`), because the knowledge records them as observations on one build and not as stable.
   
   These are **not approved**, which is different from point 1, where the ids are prohibited by a recorded owner decision. Approving one later needs evidence of its stability (the same element and class on reload, in a new session, and in more than one build) and a recorded owner decision. Until then a need that depends on one of them is an unresolved locator (section 4). This includes how a test would observe a **disabled** state when the knowledge records it only as a CSS class (`ui.activities-elements`, Toolbar).
3. A selector is not guessed. A locator is not changed without inspecting the real UI (recorded rule), and that inspection is a knowledge activity, not part of writing a page object.
4. Strict mode is not bypassed to make an ambiguous locator pass. A locator that matches more than one element is an unresolved locator (section 4).

## 3. Evidence before a new locator

A locator may be written into a page object or a component only if:

1. a reviewed knowledge document records it as verified for that element, meaning it matched exactly one element under Playwright's strict mode; or
2. it has first been verified through the normal knowledge process (inspection, document update, changelog entry), and then meets point 1.

Locators stay **private** to their page object or component. Tests never contain locator calls. A locator written for a component is scoped to the component's root.

All verified locators rely on English UI text; other languages are not examined (`ui.locator-conventions`, Limits). The locale assumption is in `architecture.md`, section 8.

## 4. Unresolved locators

A locator that automation needs and that is not sufficiently verified is an **unresolved locator**. This section is the policy for handling one in a future implementation. None of the items below is inspected by Phase 4 Step 4.

### 4.1 What the implementation agent must do (S4-4)

1. **Stop and do not guess (Derived from P4-6).** The agent writes no locator for the element: no guess, no placeholder, no `.first()`, `.nth()`, class selector or text workaround. A disambiguation of any kind (scoping, an exact-name option, an index) is itself a candidate that needs the evidence of 4.3 before it is used.
2. **Record (Proposed).** The agent adds an item to `workspace/phase4/locator-follow-ups.md` (created when the first item arises; it does not exist now) with: an id `LF-<n>`; the element and screen; the page object or component that would hold it; the knowledge document that records what is known; what is missing; the test that needs it; the status (`open`, `inspection requested`, `verified`, `rejected`); and dates.
3. **Report (Proposed).** The agent tells the owner which test is blocked and why, and continues only with work that does not depend on the item and that stays inside approved existing coverage. It does not widen coverage to fill the time.
4. **Do not inspect (Derived from P4-6 and the standing rule to do only what the latest instruction says, `PROJECT_STATUS.md` section 8).** The agent does not inspect the live Director on its own. An inspection needs an explicit owner instruction that names the item or items.

### 4.2 Who or what approves (Proposed)

- **Approving an inspection:** an owner instruction naming the item(s).
- **Approving a selector:** the owner's acceptance of the knowledge update that records it as verified, that is, a `reviewed` knowledge document with a changelog entry (the project's existing knowledge process, `knowledge/_meta/`). The implementation agent never approves its own selector, and a selector is not "approved" by passing once in a test.
- A selector rejected or found unstable closes its item as `rejected`, and the need stays unresolved until another strategy is evidenced.

### 4.3 Evidence required before a selector is approved (Proposed)

A selector is approved only when the knowledge records, for the **stated page state** (for example "the list holds past activities" or "after hovering the row"):

1. the element identified on the live UI, and which approved strategy locates it (section 1; classes and numbered ids are not approved, section 2);
2. that it matched **exactly one** element under Playwright's strict mode, the standard `ui.locator-conventions` applies to its verified locators;
3. for a repeated structure (rows, items with identical names), the scope that makes the match unique, and evidence that the scope itself is unique;
4. the UI language and the build it was verified on (all current evidence is English and build 11.3.0.112329);
5. how the element's **state** is observed where a test needs it (visible, enabled, disabled, selected), by an approved strategy.

The five locators listed in section 1 were verified before this standard and are accepted as the knowledge records them (section 3). Section 4.3 applies to selectors approved after it (clarification, no new rule).

## 5. Unresolved items already visible in the knowledge

Seeded from the existing knowledge so they are not forgotten; the register file is created when an item is first needed. Nothing is inspected, and no candidate selector is proposed. Item ids below are provisional.

| Item | What the knowledge records | What is missing for approval | Source |
|---|---|---|---|
| LF-1 Activities toolbar: Restart, Stop, Remove | `div` elements with `role="presentation"` and `title` attributes "Restart", "Stop", "Remove"; not exposed as buttons; the disabled state is a CSS class `disabled`, with no `aria-disabled` | strict-uniqueness evidence for an approved strategy; how a test observes enabled or disabled, since the class is not approved (section 2) and that observation would need an owner decision | `ui.activities-elements` |
| LF-2 Activities search | the Search control is a `div` container plus a `div.searchButton` with no title; the input with placeholder "Search" appears and is focused after a click at the left of the box; an attempt with `.searchButton` did not open it and the cause was not found | an approved way to open the control, and strict-uniqueness evidence for the opened input | `ui.activities-elements`, `ui.activities` |
| LF-3 Sidebar item "Activities" | `getByTitle('Activities')` matched **two** elements on both Overview and Activities; the second was not identified; the first match was used only for exploration | identification of the second element, and a verified unique scope; until then the Activities navigation locator is unresolved and `.first()` is not used | `ui.activities-elements` |
| LF-4 Overview panels, counters, Agenda controls | headings and labels were read from page text; `data-testid` was found only in the Events table (`getByTestId('event-table')` matched exactly one; its child test ids are recorded as observed, not as verified individually); the **Today** button is recorded as an actual button element | per-panel roots, and strict-uniqueness evidence for each element a test would use, including the Agenda arrows, the legend items and the counters | `ui.overview`, `ui.overview-panels`, `ui.locator-conventions` |
| LF-5 Sidebar items other than Overview and Logout, and the Logout menu entries | only Overview and Logout were inspected as elements; the menu shows the user's name, a Profile link and a Log out link | the elements those entries expose, and strict-uniqueness evidence | `ui.overview`, `ui.authentication-flows` |
| LF-6 The row "…" control | exists after hovering a row; its function is not known | its function and a verified locator | `ui.activities-elements` |

The numbered ids and `x-*` classes are not an item: they are decided in section 2.
