# Changelog

Governance document. Newest entries first. Record every addition, re-verification, supersession and exclusion decision.

## 2026-10-12 (Backup for Database job)

- **New area `backup`** registered in `vocabulary.md`. One document: `workflows/backup/backup-job-wizard.md` (T1, draft, medium confidence), reconciled from the live explorations of 2026-10-07 and 2026-10-08 (wizard steps, run dialog, result states, manage menu) and the Atomic Spec section 2. Not re-verified on 2026-10-12: no live access was allowed that day.
- No other vocabulary terms were needed.

## 2026-10-12 (Inventory Add / Edit / Remove knowledge)

- **New area `inventory`** registered in `vocabulary.md`. Seven documents, all `trust_tier: T1`, `status: draft` (awaiting review), Director 11.2.1.112232:
  - `workflows/inventory/add-mssql-item.md`, `edit-mssql-item.md`, `remove-mssql-item.md`
  - `ui/inventory/mssql-form-rules.md`, `credentials-management.md`, `item-page-and-list.md`, `automation-notes.md`
- **Sources:** earlier live investigations (2026-10-07 to 2026-10-09), reconciled into these documents, plus new read-only checks on 2026-10-12: Edit form field states, Cancel prompt, Remove dialog (opened and cancelled), AG-name length limit. Nothing was saved, added or removed during those checks.
- **New confirmed facts:** Type is disabled on Edit; passwords are a 15-character mask; Cancel on Edit asks "Close the wizard?" even without changes; AG name and Instance name accept up to 255 characters (the cases say 511); exact tooltip texts for the three types that have them.
- **Still marked not verified inside the documents:** unsupported SQL versions, Save validation on Edit, Remove without an option, credential Delete effects, the Read-Scale database list.

## 2026-10-02 (Phase 2.3.6)

- **Reviewed `ui/screens/overview-panels.md`** against the captured page text and screenshots and cross-checked it with `ui.overview` and `ui.locator-conventions`. Evidence, metadata (T1, `medium`, `current-ui-behavior`, ids and links), scope and the absence of lab values passed. Corrections (statements beyond the evidence): `how_verified` no longer says that no control was clicked (the Overview screenshot was taken with the sidebar Logout menu open, and the Settings badge also came from the Activities page); "banners are conditional" became "the banner area is not constant"; the Settings badge sequence "5, then 6" became "5 in some observations, 6 in another" (the real order was 5, 6, 5); "the Data Security item was not expanded" became "was not clicked".
- **Promoted `ui.overview-panels` from `draft` to `reviewed`.**
- **Corrections to reviewed documents, resolving the open items (evidence: this review and Step 15):** `ui/screens/overview.md`: the unexplained-number sentence is now the Settings badge fact, the summary-counter list gains **Activities**, and the Jobs categories gain **Successful**; `ui/locator-conventions.md`: both "top navigation" wordings are now "left sidebar".
- **Phase 2 status:** steps 2.3.1 to 2.3.6 are complete for the areas the repository records (Authentication, Activities, Overview). No further priority area is recorded in the repository, so none was added. Still open: the tier rule for unreconciled Confluence specifications, whose content therefore remains excluded.

## 2026-10-02 (Phase 2.3.5)

- **Overview knowledge ingestion.** Added `ui/screens/overview-panels.md` (`ui.overview-panels`): T1, `current-ui-behavior`, `confidence: medium` (page text and screenshots at one viewport size), `status: draft`, build 11.3.0.112329, `area: cross-cutting`, `relates_to: [ui.overview]`. Records what `ui.overview` lacks: the page structure at one viewport, conditional banners (including a new-version banner seen in a later observation), the seven summary counters (adds **Activities**) and the badges on Jobs and Nodes, the Agenda controls and columns, the Speed chart axes, the Jobs panel legend with its five categories (adds **Successful**), the changing badge on the Settings sidebar item, and the Data Security chevron. Source: page text and screenshots already captured on 2026-10-01; no new UI exploration.
- **Excluded:** Confluence statements about the Overview dashboards (unreconciled specifications; no valid tier under the current governance rules). Counter values, dates and other lab data.
- The new document contradicts, by omission, three statements in the reviewed `ui/screens/overview.md` (its counter list lacks Activities, its Jobs categories lack Successful, and its Settings-number sentence is outdated). They are left for the Overview review step (2.3.6). No existing document was changed.

## 2026-10-02 (Phase 2.3.4)

- **Reviewed `ui/screens/activities-elements.md`** against the Step 15 observations and cross-checked it with `ui.activities` and `ui.locator-conventions`. Source and evidence, metadata (T1, `high`, `current-ui-behavior`, ids and links), scope and the absence of lab-specific data all passed; no contradiction with the reviewed documents was found.
- **Corrections (statements beyond the evidence):** "list contents change as activities occur" and "exact-text lookups matched several rows" were removed (not observed); the search field's `searchButton` is described by position instead of as contained in the field; the row-checkbox statement is limited to the two sampled; the name `title` is "equal to the name", not "the full name"; the `activity-manage` cell is "seen on the first rows listed" and the hover control is "at the right end of that row" instead of "in that row's cell".
- **Promoted `ui.activities-elements` from `draft` to `reviewed`.**
- **Governance consistency:** `source-registry.md` S1 now lists the login page and authentication flows, the Overview page and the Activities page as the inspected areas (it still said login and Overview only); the Phase 2.3.3 entry below was corrected to say that one attribute from `ui.activities` is kept for context.
- Not changed: the carried-forward items (`ui/locator-conventions.md` "top navigation" wording, the Settings number in `ui/screens/overview.md`, the Confluence tier rule).

## 2026-10-02 (Phase 2.3.3)

- **Activities knowledge ingestion.** Added `ui/screens/activities-elements.md` (`ui.activities-elements`): T1, `current-ui-behavior`, `confidence: high`, `status: draft`, build 11.3.0.112329, `area: cross-cutting`. It records how the Activities screen's elements are exposed in the page (no `data-testid`/`aria-label`, the toolbar controls as `div`s with `role="presentation"` and a `disabled` CSS class, the search field, checkboxes, row cells, the status badge element, the hover "…" control's element, the popup container, the two-match `getByTitle('Activities')`). Source: the DOM observations made during the Step 15 live-UI reconciliation; no new UI exploration. Facts already in `ui.activities` were not restated, apart from the select-all `title` attribute kept for context.
- **What was not added, and why:** the Confluence "Activities dashboard" statements that the UI confirmed are already in `ui.activities` (reviewed, T1). The statements the UI could not confirm (running state, Stop dialog, Skipped, effects of Restart/Remove, activity types, result limits, retention) remain excluded: the tier rule for unreconciled Confluence specifications is still undecided.
- No existing document was changed. The new document awaits its separate review.

## 2026-10-02 (Phase 2.3.2)

- **Reviewed `ui/authentication-flows.md` against the recorded observations and cross-checked it with `ui/auth-session.md` and `ui/screens/login.md`.** Every behavior has matching evidence; no contradiction with the reviewed documents was found; the "Not verified" list is accurate and covers the untested areas; metadata is valid and unchanged. Two minor wording corrections were made: the evidence key for the login-form checks now says that the focused field and the LOG IN state were read, and the text in the Forgot-password view is no longer called a "link" (it was seen as underlined text, its element type was not checked).
- **Promoted `ui.authentication-flows` from `draft` to `reviewed`.** Scope stayed strictly Authentication / Session. The two cross-checked documents needed no change.
- Not changed: the open items from Step 18 (`ui/locator-conventions.md` wording, the Settings number in `ui/screens/overview.md`, the Confluence tier rule). The unreconciled Confluence specifications were not ingested.

## 2026-10-01 (Phase 2.3.1)

- **Authentication / session ingestion.** Added `ui/authentication-flows.md` (`ui.authentication-flows`): T1, `current-ui-behavior`, `confidence: high`, `status: draft`, build 11.3.0.112329, `area: cross-cutting`. Source: new live-UI observations with the test account (fresh browser contexts; no wrong credentials entered; cookie names, flags and lifetimes only, never values). Covers access without a session, the login form rules (focus, when LOG IN is enabled, Enter key), the Forgot-password view, session persistence, the session cookie, Remember me, and sign-out. Each behavior names its evidence; unknowns are listed in a "Not verified" section.
- **Reviewed documents touched only to remove statements that the new evidence made outdated, pointing to the new document instead** (no new claims added there, status unchanged): `ui/auth-session.md` (the "which input enables the button" sentence and three "Not verified" items) and `ui/screens/login.md` (the Remember me note and the "Not verified" sentence).
- **Sources identified but not ingested:** Confluence `tst` pages "Login screen (Refactored)" (edited 2026-08-28), "Enforce Strong Passwords Specification" (2026-07-03), "Two-factor authentication" (2026-05-21) and the deprecated "Facelift v.3 Login screen". They are unreconciled specifications; the tier rule for such specifications is still undecided, and the scope here was verified behavior only.
- Not changed: `ui/locator-conventions.md` ("top navigation" wording) and `ui/screens/overview.md` (Settings number), both still open from Step 18.

## 2026-10-01 (Phase 1 Step 18)

- **Promoted `ui/screens/activities.md` (`ui.activities`) from `draft` to `reviewed`.** A final consistency check found valid and unchanged metadata (T1, `high`, `current-ui-behavior`), every documented fact supported by the Step 15 reconciliation, no lab-specific data, and the "Not verified" section intact. Only the `status` field changed; no content was changed.
- **Phase 1 is complete as scoped**, with three carried-forward items: the "top navigation" wording in `ui/locator-conventions.md`, the outdated Settings-number sentence in `ui/screens/overview.md`, and the undecided tier rule for unreconciled Confluence specifications. None was changed in this step.

## 2026-10-01 (Phase 1 Step 17)

- **Reviewed `ui/screens/activities.md` against the Step 15 reconciliation.** It stays `draft`; metadata unchanged (T1, `high`, `current-ui-behavior`). Corrections (statements that went beyond what was verified): the row-checkbox statement now covers only the Past Activities rows; "clearing the checkbox disables the buttons again" was removed (not verified); the claim that the details popup closes with Escape or the × button was replaced by what was seen (a close control exists); the "…" hover button is noted as checked on one row; the search "clear" button is now just an × button; "immediately" and "tooltip" were removed; the long-title truncation is tied to the inspected name. The "Not verified" list was extended accordingly.
- **Navigation wording corrected** in `ui/screens/overview.md` (heading "Top navigation" → "Left sidebar") and `ui/auth-session.md` ("top navigation" → "left sidebar"), as found in Step 15. Nothing else in those reviewed documents changed.
- **Open:** `ui/locator-conventions.md` still says "top navigation" in two places, and `ui/screens/overview.md` still describes the number between Settings and Help as unexplained (Step 15 showed it is a notification badge on Settings). Neither was in this step's scope.

## 2026-10-01 (Phase 1 Step 16)

- **Third ingestion: Activities screen.** Added `ui/screens/activities.md` (`ui.activities`): T1, `current-ui-behavior`, `confidence: high`, `status: draft`, build 11.3.0.112329, `area: cross-cutting`. Content is limited to facts confirmed in the Step 15 live UI reconciliation: access and header, the Running/Past sections and columns, the empty-running text, observed past statuses and badge colors, ordering, row structure and name patterns (as placeholders), the toolbar and its selection behavior, live search and the no-match text, the row hover "…" button, and the details popup fields seen for one Completed activity. Running-state behavior, the Stop dialog, Skipped, the effects of Restart/Remove, the "…" menu, the search result limit, retention days and lab-specific names are excluded.
- No existing document was changed.

## 2026-10-01 (Phase 1 Step 15)

- **Read-only UI reconciliation of the Confluence "Activities dashboard" lifecycle statements against the live Activities screen** (build 11.3.0.112329). No knowledge document was created or changed. Result: no mismatch found; about half of the statements were confirmed, the rest were not verifiable in the lab (no running activity, nothing executed). Findings: the navigation is a left sidebar, the number next to Settings is a notification badge, and `getByTitle('Activities')` matches two elements.
- Recommendation recorded: ingest only the UI-confirmed facts, as a T1 screen document (done in Step 16). The tier rule for unreconciled Confluence specifications remains undecided.

## 2026-10-01 (Phase 1 Step 13.2)

- **Promoted `product.glossary` from `draft` to `reviewed`.** Basis: the review of the eight definitions against the source page and the Step 13.1 corrections; no unresolved wording issue remains. Only the `status` field changed. Metadata is otherwise unchanged (T3, `medium`, `terminology`); the document remains marked as unreconciled terminology.

## 2026-10-01 (Phase 1 Step 13.1)

- **Corrected `product.glossary` after review** (still `draft`; metadata unchanged: T3, `medium`, `terminology`). Reworded the Director, Transporter, Job, Job run, Backup (noun) and Recovery Point definitions to stay within the source's meaning, removed additions the source does not state ("protected", "between locations", "users interact with", and similar). Corrected the "controller" note (the source defines it as a part of the Director; its current relevance is unchecked) and removed an unsourced sentence about project usage of "Director".
- `source-registry.md` S3: the "Use for" line now includes unreconciled terminology (T3).

## 2026-10-01 (Phase 1 Step 13)

- **Second controlled ingestion: product terminology.** Added `product/glossary.md` (`product.glossary`), the first document in `product/`. Source: the Confluence `tst` "Definitions" page (version 20, last edited 2021-06-29), read in full; no other source used. Provenance: `source_type: confluence`, `nature: terminology`, `trust_tier: T3`, `confidence: medium`, `product_version: unknown`, `build: unknown`, `status: draft`.
- **Terms ingested (8, paraphrased):** Director, Transporter, Job, Job run, Backup (noun and verb senses), Backup Repository, Recovery Point, Inventory.
- The document is marked as unreconciled terminology. It states that no equivalence is assumed between these terms and UI labels such as "Jobs" and "Repositories".
- **Governance:** `source-registry.md` S3 now states the tier for Confluence terminology that is not reconciled with the UI (T3) and records what has been ingested from the Definitions page. The provenance schema and vocabulary needed no change.
- The four `ui/` documents were not changed. No new UI exploration, no Jira, Xray, API-spec, repository or second-hand sources.

## 2026-10-01 (Phase 1 Step 11)

- **Promoted four UI documents from `draft` to `reviewed`**: `ui.auth-session`, `ui.locator-conventions`, `ui.login` and `ui.overview`. Basis: the Step 10 review against verified evidence and the Step 10.1 certificate-wording correction; no unresolved factual correction remains.
- Only the `status` field changed. No factual content, other fields or other documents were changed. `ui.overview` keeps `confidence: medium`.

## 2026-10-01 (Phase 1 Step 10.1)

- **Corrected the certificate wording in `source-registry.md`**: it no longer says "self-signed"; it now says Chromium does not trust the certificate and the issuer was not inspected, consistent with `ui.auth-session`. No knowledge documents were changed.

## 2026-10-01 (Phase 1 Step 10)

- **Reviewed the four UI documents** against what was verified. All four remain `status: draft`.
  - Corrections (statements that went beyond the evidence): the certificate is described as untrusted, not "self-signed" (the issuer was not inspected); the LOG IN button's enabled state is described by what was observed and what the test shows; the claim that Logout "cannot appear" on the login page was replaced by what was actually inspected; `data-testid` statements were limited to the elements actually inspected; session handling is now tied to the project's Playwright configuration; Overview content descriptions were limited to what the page text showed, and the navigation element structure was corrected (the `title` is on the parent `div`).
  - `ui/locator-conventions.md` was rewritten: the five-step "order of preference" was removed because it was a proposal, not a recorded decision, and the document now states only observations and the one recorded decision (never use `ext-gen*` or `simpleIcon-*` ids). Ext JS is now stated as apparent from its conventions.
- **README:** documented `ui/screens/` as an intentional UI-specific convention (other area-specific UI knowledge may use `ui/<area>/`), and replaced the out-of-date "Current state" statement with a durable one pointing to this changelog.
- No new documents, no new sources and no new UI exploration.

## 2026-10-01 (Phase 1 Step 9)

- **First controlled ingestion: UI knowledge**, all `trust_tier: T1`, `nature: current-ui-behavior`, `status: draft` (awaiting review). Build 11.3.0.112329.
  - Added `ui/auth-session.md` (`ui.auth-session`): entry points, certificate behavior, login sequence, authenticated-state markers, session handling, and what is not verified.
  - Added `ui/locator-conventions.md` (`ui.locator-conventions`): why Ext JS generated ids are not used, the four verified locators, `data-testid` findings, and the project's order of preference.
  - Added `ui/screens/login.md` (`ui.login`): controls, locators, other page elements, structure.
  - Added `ui/screens/overview.md` (`ui.overview`): route, title, top navigation, content areas seen, `data-testid` findings. Confidence `medium` (inspected once, superficially).
- Sources: facts already verified in earlier steps on the live Director and in the two passing login tests. No new exploration. No Confluence, Jira, Xray or API content was ingested.
- The `ui/screens/` subfolder was chosen by the project owner for screen documents; screen documents currently use `area: cross-cutting` and ids of the form `ui.<slug>`.
- No new vocabulary terms were needed.

## 2026-10-01

- **Created the knowledge foundation**: `README.md` and `_meta/` (`source-registry.md`, `provenance-schema.md`, `exclusions.md`, `vocabulary.md`, `changelog.md`), following the approved knowledge model revision 2.
- No knowledge content has been ingested. The categories `product/`, `ui/`, `workflows/`, `qa/`, `automation/` and `sources/` do not exist yet.
- Registered the currently verified sources and their limits in `source-registry.md`.
- Recorded the security and exclusion rules in `exclusions.md`, including the known case of secrets in Jira comments on NJM-189365.
