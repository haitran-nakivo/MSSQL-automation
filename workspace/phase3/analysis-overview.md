# Phase 3: Overview analysis (milestone 3.4, Overview only)

Status: **DRAFT, included in the Phase 3 audit (milestone 3.6).** Date: 2026-10-02. Derived working material in `workspace/`, not part of the knowledge layer. Applies `analysis-rubric.md` (C1 to C8 unchanged, approved) and the evidence rules and conventions used for `analysis-authentication.md` and `analysis-activities.md` (both approved) to the 12 approved Overview cases of `selected-cases.md`. No numeric scores, no ranking, no total. The case-level shortlist rule is applied (owner decision).

Sources used: the case text (E1, from a read-only Jira fetch on 2026-10-02: title, description, step action, expected result, label; no comments, no attachments, no enriched archives, no linked issues; the Confluence links inside the cases were **not followed**, decision D3 and the standing exclusion of unreconciled specifications), and the reviewed knowledge documents `ui.overview` and `ui.overview-panels` (E2, cited by id and section). No UI was explored. No Jira case was modified. No locators, code or scripts were written.

## 1. Conventions and rubric gaps checked before applying the rules

1. Conventions 1 to 9 of `analysis-authentication.md` and 1 to 6 of `analysis-activities.md` apply unchanged (statement ids, bare labels are not actions, statements counted wherever they are, side-effect class from the steps as written, cross-case comparison as a secondary check only, C1 Not executable blocks all statements at the statement level).
2. **The Overview expected-result sentence.** Eight cases say "the product UI shall be displayed in the installer's selected language, no breaking UI, and reasonable truncates" and then a link. As in Activities it is three statements: **L** (language), **B** (no breaking UI) and **T** (reasonable truncation). Each is intent Presentation, C3: P, Generic, By judgment, scope stated (the title names the widget; the action names the scope "screen" with "zoom in, zoom out and different resolutions"), so each is the **property "limited verifiability"**. The criteria for "breaking" and "reasonable" are undefined (as Q-103495-1 in Activities).
3. **Link statements, called R.** Where the expected result ends in a link to a specification page, the link is a statement R: "the UI matches the page behind the link". The page was not followed, so R cannot be decided from the allowed sources.
4. **"Check screen (with zoom in, zoom out and different resolutions)"** is an action. The title names a widget, the action says "screen", and neither the zoom levels nor the resolutions are given (Q-98616-3, shared by every case with this action). The viewport is therefore a C4 dimension 7 item, Stated but with no values.
5. **Rubric gaps (owner: identify before applying).**

| Gap | Relevant to Overview? | Handling |
|---|---|---|
| (a) A P statement that is Reference-only has no row in the C3 table | **Yes.** The statements R in NJM-98635, 98628, 98625, 98631, 98638, 98633, 98642, 98640, the Figma pointer in NJM-98655 (P3) and the FORMAT8 pointer in NJM-98616 (A13) are presentation pointers | Recorded as a **property**, not a finding, as for the Authentication pointers ("See Figma", "same as A2"). Verifiability is recorded Not verifiable (the target is outside the allowed sources), so each is "Needs human judgment" at the statement level. No effect at case level. |
| (b) A P statement that is Specific but By judgment has no row | Not material in Overview | n/a |
| (c) "Blocked: case quality" lists missing, inconsistent and contradictory, not weak | Not applied: no readiness result depends on it | n/a |
| (d) "Partly supported" is not a readiness blocker | Applied literally to the NJM-98616 statements A1 and A7, shown in the statement-level view | recorded there |

No rubric rule was changed and no resolution was invented.

## 2. Knowledge gaps (shared by the cases, listed once)

Documents checked for every item: `ui.overview` (including Not verified) and `ui.overview-panels` (including Not verified). Both have confidence medium and describe one viewport (1600 by 1000).

| Id | Gap | Kind | Cases |
|---|---|---|---|
| K-overview-1 | Localization: the "installer's selected language" is not in the knowledge, and the Overview documents record one language only | absent; unverified | all 12 |
| K-overview-2 | Whether any panel breaks or truncates, and the layout at other viewport sizes, zoom levels or resolutions (listed as not verified: "the layout at other viewport sizes") | unverified | all 12 |
| K-overview-3 | Widgets the knowledge does not record: Backup size, Total backup storage, Node tasks, Nodes (absent); Job statistic and Repositories (only the headings were seen) | absent; insufficient detail | 98635, 98625, 98633, 98642, 98631, 98640 |
| K-overview-4 | Widget behavior: Agenda arrows and Today, legend items, counters, Events paging, search and filter (listed as not verified) | unverified | 98616, 98644 |
| K-overview-5 | Loading and refresh timing, and the Events table with a very large number of events (loading timing listed as not verified) | unverified; absent | 98644 |
| K-overview-6 | Summary-bar alarms: the badges on Jobs and Nodes were seen, their meaning was not examined; no 999+ cap is recorded | unverified; absent | 98607 |
| K-overview-7 | Content that depends on the user's role or permissions (listed as not verified); the "No access" permission and the text shown to a restricted user | unverified; absent | 98655 |
| K-overview-8 | Agenda against the Activities dashboard and the Calendar dashboard (the Calendar is not covered; running items in the Agenda were not observed) | absent | 98616 |
| K-overview-9 | Specification pointers and definitions the cases rely on (FORMAT8, the Figma sample, the widget pages behind the links) | absent (the sources are excluded) | 98616, 98655, 98635, 98628, 98625, 98631, 98638, 98633, 98642, 98640 |

## 3. Per-case analysis

Selection order of `selected-cases.md` is kept. L, B, T and R are defined in conventions 2 and 3.

### 3.1 NJM-98644: Events widget - Check Events widget with 100k-500k items

Case: NJM-98644  Area: Overview  Stratum: Events widget  (1 step)

**Intent (step 0): Mixed** [E1]. The action lists loading times (non-functional), changing page (functional), breaking UI and truncation (presentation).

**C1: Executable.** The step ("Check widget loading times, changing page, breaking UI, truncation,…etc") is an action; the target is the Events widget (title). Granularity: bundled, and open-ended ("…etc"). Feature-status references: none.

**C2: Partial.** Declared: the data volume (title: 100k-500k items). Undeclared: how that volume is obtained, the page size and what "changing page" covers (E3).

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | Loading times of the widget are checked | NF, **Empty** (no acceptance criterion): finding | NV [E2: ui.overview, Not verified: loading and refresh timing] K-5 |
| S2 | Changing page works | F, **Empty**: finding | NV [E2: ui.overview, Not verified: how the widgets behave] K-4 |
| S3 | No breaking UI | P, **Empty** | NC [E2: ui.overview, Content areas: the Events table and its test ids are recorded; behavior at this volume is not] K-2, K-5 |
| S4 | Truncation | P, **Empty** | NC, K-2, K-5 |

Decisive statements: 4 (the open "…etc" is not a checkable statement). C7: 0 supported, 0 partly, 2 not covered, 2 not verifiable.

**C4:** D1 none; D2 none; D3 none; D4 100,000 to 500,000 events [Stated in the title]; D5 loading time [Stated]; D6 none; D7 browser and locale [Unstated]; D8 producing that many events [`UNKNOWN(absent)`]. **Side-effect class: None** (the steps only observe).
**C5: UI-only** [E3]. **C6: Data-dependent**, **Time-dependent** [E1, loading times].
**C8 case level:** **Needs human judgment** (all four statements have an Empty expected result, so verifiability is Not verifiable). Readiness **Not applicable**. Statement-level view: Needs human judgment for all four.

Findings: **F-98644-1** (C3, missing expected result): the expected-result field is empty for a case that sets out to check performance and behavior [E1]. **F-98644-2** (C1): the action ends with "…etc", so the scope of the check is open [E1].
Risks: **R-98644-1** trigger: producing 100,000 to 500,000 events for the check; effect: the shared instance's event store grows and slows other work, and a loading time measured there depends on the environment; scope: the instance and this case. [E3]
Knowledge gaps: K-2, K-4, K-5.
Open questions: **Q-98644-1** what loading time and what page behavior count as acceptable (no source states them).

### 3.2 NJM-98616: Agenda widget - Check UI

Case: NJM-98616  Area: Overview  Stratum: Agenda widget  (1 step)

**Intent: Mixed** [E1]: one step with presentation statements (names, texts) and functional statements (what the widget lists, what the arrows and Today do).

**C1: Executable.** The step ("Check screen (with zoom in, zoom out and different resolutions)") is an action. Granularity: bundled (sixteen statements in one step). Actions the expected result needs but the step does not state: clicking the arrows and Today (E3). Feature-status references: none.

**C2: Absent.** Needs [E1/E3]: running activities of several kinds and scheduled activities of several kinds (E1); the Activities and Calendar dashboards to compare with (E1); a current week (E1). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| A1 | The widget shows activities sorted by date | F, Spec, Obj | **Part** [E2: ui.overview-panels, Agenda panel: a table with Date, Time and Activities is recorded; its order is not] |
| A2 | It shows everything the product is doing now (FLR/OLR, export, running jobs, maintenance, self backup, "etc..") | F, Spec, **Jdg** (open list) | NV [E2: ui.activities, Not verified: nothing about a running activity] K-4, K-8 |
| A3 | These are the same activities as on the Activities dashboard | F, Spec, Obj | NV [E2: ui.overview, Not verified: how the widgets behave] K-8 |
| A4 | It shows all scheduled activities (jobs, maintenance, reports, "etc..") | F, Spec, **Jdg** (open list) | **Part** [E2: ui.overview-panels, Agenda panel: rows for later days with `Self-backup` are recorded; the other kinds are not] |
| A5 | These are the same scheduled activities as on the Calendar dashboard | F, Spec, Obj | NC, K-8 |
| A6 | Widget name "Agenda" | P, Spec, Obj | **Sup** [E2: ui.overview-panels, Agenda panel: heading Agenda; ui.overview, Content areas] |
| A7 | The week navigator shows "{0} - {1}" for the displayed week (example "1 Nov - 7 Nov") | P, Spec, Obj | **Part** [E2: ui.overview-panels, Agenda panel: a date-range label with arrows is recorded; its text pattern is not] |
| A8 | {0} is the Monday of the current week | F, Spec, Obj | **Sup** [E2: ui.overview-panels, Agenda panel: the range shown was a Monday-to-Sunday week that contained the observation date] |
| A9 | {1} is the Sunday of the current week | F, Spec, Obj | **Sup** [E2: same] |
| A10 | The right arrow updates the navigator text and the table to the next week | F, Spec, Obj | NV [E2: ui.overview-panels, Not verified: what the previous and next arrows, Today ... do] K-4 |
| A11 | The left arrow does so for the previous week | F, Spec, Obj | NV [E2: same] K-4 |
| A12 | The Today button does so for the current week | F, Spec, Obj | NV [E2: same] K-4 |
| A13 | Dates use FORMAT8 | P, **Ref** (gap (a)) | NC, K-9 |
| L, B, T | | rule 2 | L NV (K-1); B, T NC (K-2) |

Decisive statements: 16. C7: **3 supported** (A6, A8, A9), **3 partly supported** (A1, A4, A7), 4 not covered (A5, A13, B, T), 6 not verifiable (A2, A3, A10, A11, A12, L).

**C4:** D1 the Activities and Calendar dashboards [Stated]; D2 none; D3 none; D4 activities and scheduled items of several kinds [Stated]; D5 "the current week", Today [Stated]; D6 none; D7 zoom levels, resolutions, locale [Stated, values Unstated]; D8 none. **Side-effect class: None.**
**C5: UI-only** [E1].
**C6: Time-dependent** [E1, current week]; **Data-dependent**; **Transient-state** [E3, running items].
**C8 case level:** **Needs human judgment** (L, B, T, A2, A4 are By judgment; A13 is a pointer). Readiness **Not applicable**.
Statement-level view (informational): Suitable at the UI level: A1, A3, A5, A6, A7, A8, A9, A10, A11, A12 (10). Needs human judgment: A2, A4, A13, L, B, T (6). Readiness of the 10 (C1 is Executable): **Ready**: A6, A7, A8, A9; **Ready after information**: A1 (the only gap is the undeclared need for activities on different dates); **Blocked: knowledge** (no other blocker): A3, A5, A10, A11, A12 (statement-level near candidates). A1 and A7 are partly supported, which the rubric does not list as a blocker (gap (d)); A8 and A9 rest on one observed week (confidence medium).

Findings: **F-98616-1** (C3, weak expected result): A2 and A4 end their lists with "etc..", so completeness cannot be decided against a closed list [E1].
Risks: **R-98616-1** trigger: running the case across the Sunday and Monday boundary, or in another time zone (the panel shows a time-zone chip); effect: the "current week" and the rows change under the check; scope: A1 and A6 to A12. [E2: ui.overview-panels, Agenda panel, and E3]
Knowledge gaps: K-1, K-2, K-4, K-8, K-9.
Open questions: **Q-98616-1** what FORMAT8 is (outside the allowed sources). **Q-98616-2** what counts as "the same activities" when comparing the Agenda with the Activities and Calendar dashboards, and whether running items appear in the Agenda. **Q-98616-3** whether "screen" means the whole Overview or the widget, and which zoom levels and resolutions are meant (shared by every case with this action).

### 3.3 NJM-98607: Summary bar - Single tenant - Check 999+ issues alarms

Case: NJM-98607  Area: Overview  Stratum: Summary bar  (1 step)

**Intent: Presentation** [E1]: the check is of how alarms with more than 999 issues are displayed.

**C1: Executable.** The step ("Check 999+ issues alarms for jobs/nodes/repositories/monitored items/activities") is an action with an identifiable target. Granularity: bundled (five counters). Feature-status references: none.

**C2: Partial.** Declared: single-tenant mode and the volume ("999+") in the title. Undeclared: how more than 999 issues are produced for five kinds of object (E3).

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property). The case does not state what a "999+" alarm should show, and nothing is inferred (Q-98607-1) | L NV (K-1). B, T NC [E2: ui.overview-panels, Summary counters: the seven counters and the red badges on Jobs and Nodes are recorded; their meaning and any cap are not] K-2, K-6 |

Decisive statements: 3. C7: 0 supported, 0 partly, 2 not covered, 1 not verifiable.

**C4:** D1 none; D2 none; D3 single tenant [Stated]; D4 more than 999 issues for jobs, nodes, repositories, monitored items and activities [Stated]; D5 none; D6 none; D7 locale [Stated]; D8 producing the issues [`UNKNOWN(absent)`]. **Side-effect class: None.**
**C5: UI-only** [E3]. **C6: Data-dependent** [E1].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all three.

Findings: none.
Risks: **R-98607-1** trigger: producing more than 999 issues for five kinds of object; effect: alarms and counters on the shared instance change for every user and the state is hard to remove; scope: the instance. [E3]
Knowledge gaps: K-1, K-2, K-6.
Open questions: **Q-98607-1** what a "999+" alarm should show and which badges it concerns; the case names the check but states no expected value.

### 3.4 NJM-98635: Backup size widget - Check UI

Case: NJM-98635  Area: Overview  Stratum: Backup size widget  (1 step)

**Intent: Presentation** [E1]. **C1: Executable** (the step is the "Check screen (with zoom ...)" action). Granularity: bundled. Feature-status references: none.
**C2: Absent.** Needs: values long enough to truncate and a stated viewport (E3). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.overview-panels does not record this widget] K-2, K-3 |
| 1 | R: the specification page behind the link | P, **Ref** (gap (a)), NotV | NC, K-9 |

Decisive statements: 4. C7: 0 supported, 0 partly, 3 not covered, 1 not verifiable.

**C4:** D1 to D3 none; D4 widget data [Implied]; D5 none; D6 none; D7 zoom levels, resolutions [Stated, values Unstated], locale [Stated]; D8 none. **Side-effect class: None.**
**C5: UI-only** [E3]. **C6: Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all four.

Findings: none. Risks: **R-98635-1** trigger: checking presentation at unspecified zoom levels and resolutions (the knowledge records one viewport); effect: the same check can pass or fail with the viewport; scope: every "Check screen" case of this area (98616, 98635, 98655, 98628, 98625, 98631, 98638, 98633, 98642, 98640). [E2: ui.overview-panels, Not verified: layout at other viewport sizes; E3]
Knowledge gaps: K-1, K-2, K-3, K-9. Open questions: none beyond Q-98616-3.

### 3.5 NJM-98655: General - Permissions - In case the user does not have permission to use a functionality

Case: NJM-98655  Area: Overview  Stratum: General  (1 step)

**Intent: Mixed** [E1]: what a widget shows to a restricted user (functional) and its text and sample (presentation).

**C1: Partly executable.** The step ("Check screen (with zoom ...)") is an action, but its example depends on a permission "(to be implemented with NJM-86708)", which the case marks as not yet available. Granularity: bundled. Feature-status references: **unimplemented** (the Nodes permission).

**C2: Absent.** Needs [E1]: a user without permission for a functionality; a user with "Nodes permission" set to "No access"; or a product with no transporter nodes (the stray first condition). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| P1 | The widget related to a functionality the user may not use displays an empty UI | F, Spec, Jdg ("empty UI" has no criterion; the stray condition makes the trigger unclear) | NV [E2: ui.overview, Not verified: whether the content depends on the user's role or permissions] K-7 |
| P2 | Text "You do not have permissions to use this functionality" | P, Spec; consistency `UNKNOWN(ambiguous)` (the case says "empty UI" and then gives a text; whether the text is in the empty UI is not clear) | NV, K-7 |
| P3 | "See sample Figma" | P, **Ref** (gap (a)) | NC, K-9 |
| P4 | A user with Nodes permission "No access" sees empty Nodes and Node tasks widgets | F, Spec, Jdg | NV, K-3, K-7 |
| L, B, T | | rule 2 | L NV (K-1); B, T NC (K-2) |

Decisive statements: 7. C7: 0 supported, 0 partly, 3 not covered (P3, B, T), 4 not verifiable (P1, P2, P4, L).

**C4:** D1 NJM-86708 and the Nodes permission [Stated]; D2 none; D3 roles and permissions [Stated]; D4 users in two permission states [Stated]; D5 none; D6 none; D7 locale [Stated]; D8 changing a user's permission to reach the state [`UNKNOWN(absent)`]. **Side-effect class: None** (the steps only observe).
**C5: UI-only** [E3]. **C6: Repeatable** [E3] once the state exists.
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Suitability `UNKNOWN`: P2; Needs human judgment: P1, P3, P4, L, B, T.

Findings: **F-98655-1** (C3, inconsistent expected result, mismatched content): the expected result opens with "In case there are no transporters nodes in the product", a condition about nodes, while the title and the rest are about a user without permission [E1]. **F-98655-2** (C3, misleading wording): "shall display an empty UI" is followed by a text to display, so the case does not say whether the text belongs to the empty UI [E1].
Risks: **R-98655-1** trigger: changing a user's permissions to reach the state; effect: that user's access changes for every other test using the account; scope: shared lab accounts. [E3]
Knowledge gaps: K-1, K-2, K-3, K-7, K-9.
Open questions: **Q-98655-1** how the stray condition relates to the title. **Q-98655-2** whether the "No access" permission and the Nodes widgets exist in the build under test (NJM-86708 was not read).

### 3.6 NJM-98628: Speed widget - Check UI

Case: NJM-98628  Area: Overview  Stratum: Speed widget  (1 step)

**Intent: Presentation** [E1]. **C1: Executable** ("Check screen (with zoom ..." action). Granularity: bundled. Feature-status references: none.
**C2: Absent.** Needs: values long enough to truncate and a stated viewport (E3). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.overview-panels, Speed (Mbit/s) panel: the heading and the chart ticks are recorded; breaking and truncation are not] K-2 |
| 1 | R: the specification page behind the link | P, **Ref** (gap (a)), NotV | NC, K-9 |

Decisive statements: 4. C7: 0 supported, 0 partly, 3 not covered, 1 not verifiable.

**C4:** D4 chart data over the last days [Implied, E2: ui.overview-panels shows seven days ending on the observation date]; D5 relative dates [Implied]; D7 viewport [Stated, values Unstated], locale [Stated]; D1 to D3, D6, D8 none. **Side-effect class: None.**
**C5: UI-only** [E3]. **C6: Data-dependent**, **Time-dependent** [E2, ticks relative to the observation date].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all four.

Findings: none. Risks: see R-98635-1. Knowledge gaps: K-1, K-2, K-9. Open questions: none beyond Q-98616-3.

### 3.7 NJM-98625: Total backup storage widget - TSW-1

Case: NJM-98625  Area: Overview  Stratum: Total backup storage widget  (1 step)

**Intent: Presentation** [E1]. **C1: Executable.** Granularity: bundled. Feature-status references: none.
**C2: Absent.** Needs: values long enough to truncate and a stated viewport (E3). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.overview-panels does not record this widget] K-2, K-3 |
| 1 | R: the specification page behind the link | P, **Ref** (gap (a)), NotV | NC, K-9 |

Decisive statements: 4. C7: 0 supported, 0 partly, 3 not covered, 1 not verifiable.

**C4:** D4 widget data [Implied]; D7 viewport [Stated, values Unstated], locale [Stated]; others none. **Side-effect class: None.** **C5: UI-only** [E3]. **C6: Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all four.

Findings: none. Risks: see R-98635-1. Knowledge gaps: K-1, K-2, K-3, K-9. Open questions: none beyond Q-98616-3.

### 3.8 NJM-98631: Job statistic widget - Check UI

Case: NJM-98631  Area: Overview  Stratum: Job statistic widget  (1 step)

**Intent: Presentation** [E1]. **C1: Executable.** Granularity: bundled. Feature-status references: none.
**C2: Absent.** Needs: values long enough to truncate and a stated viewport (E3). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.overview-panels, Structure: the heading Job statistic was seen at the bottom edge; contents were not examined] K-2, K-3 |
| 1 | R: the specification page behind the link | P, **Ref** (gap (a)), NotV | NC, K-9 |

Decisive statements: 4. C7: 0 supported, 0 partly, 3 not covered, 1 not verifiable.

**C4:** D4 widget data [Implied]; D7 viewport [Stated, values Unstated], locale [Stated]; others none. **Side-effect class: None.** **C5: UI-only** [E3]. **C6: Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all four.

Findings: none. Risks: see R-98635-1. Knowledge gaps: K-1, K-2, K-3, K-9. Open questions: none beyond Q-98616-3.

### 3.9 NJM-98638: Jobs widget - Check UI

Case: NJM-98638  Area: Overview  Stratum: Jobs widget  (1 step)

**Intent: Presentation** [E1]. **C1: Executable.** Granularity: bundled. Feature-status references: none.
**C2: Absent.** Needs: values long enough to truncate and a stated viewport (E3). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.overview-panels, Jobs panel: the donut, the "In Total" label and the five legend categories are recorded; breaking and truncation are not] K-2 |
| 1 | R: the specification page behind the link | P, **Ref** (gap (a)), NotV | NC, K-9 |

Decisive statements: 4. C7: 0 supported, 0 partly, 3 not covered, 1 not verifiable.

**C4:** D4 job counts [Implied]; D7 viewport [Stated, values Unstated], locale [Stated]; others none. **Side-effect class: None.** **C5: UI-only** [E3]. **C6: Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all four.

Findings: none. Risks: see R-98635-1. Knowledge gaps: K-1, K-2, K-9. Open questions: none beyond Q-98616-3.

### 3.10 NJM-98633: Node tasks widget - Check UI

Case: NJM-98633  Area: Overview  Stratum: Node tasks widget  (1 step)

**Intent: Presentation** [E1]. **C1: Partly executable.** The step is an action, but the description's link carries "(to be implemented with NJM-86708)", so the widget the case checks is marked as not yet available. Granularity: bundled. Feature-status references: **unimplemented**.
**C2: Absent.** Needs: a build in which the widget exists (E1), values long enough to truncate and a stated viewport (E3). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: the widget is not recorded] K-2, K-3 |
| 1 | R: the specification page behind the link | P, **Ref** (gap (a)), NotV; the link anchor names the Job statistic widget, not this one | NC, K-9 |

Decisive statements: 4. C7: 0 supported, 0 partly, 3 not covered, 1 not verifiable.

**C4:** D1 NJM-86708 [Stated]; D4 widget data [Implied]; D7 viewport [Stated, values Unstated], locale [Stated]; others none. **Side-effect class: None.** **C5: UI-only** [E3]. **C6: `UNKNOWN(not-tested)`** (the widget's availability is not stated).
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all four.

Findings: **F-98633-1** (misleading content): the link in the expected result points to the Job statistic widget section, while the title and the description are about the Node tasks widget [E1].
Risks: **R-98633-1** trigger: running the case on a build in which the widget is not implemented; effect: the check fails or finds nothing for a reason unrelated to presentation; scope: this case. [E1 marker, E3]
Knowledge gaps: K-1, K-2, K-3, K-9.
Open questions: **Q-98633-1** which widget the link is meant to describe. **Q-98633-2** whether the Node tasks widget exists in the build under test (NJM-86708 was not read).

### 3.11 NJM-98642: Nodes widget - Check UI

Case: NJM-98642  Area: Overview  Stratum: Nodes widget  (1 step)

**Intent: Presentation** [E1]. **C1: Partly executable.** The step is an action, but the description's and the expected result's link both carry "(to be implemented with NJM-86708)". Granularity: bundled. Feature-status references: **unimplemented**.
**C2: Absent.** Needs: a build in which the widget exists (E1), values long enough to truncate and a stated viewport (E3). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.overview-panels records a Nodes counter, not a Nodes widget] K-2, K-3 |
| 1 | R: the specification page behind the link | P, **Ref** (gap (a)), NotV | NC, K-9 |

Decisive statements: 4. C7: 0 supported, 0 partly, 3 not covered, 1 not verifiable.

**C4:** D1 NJM-86708 [Stated]; D4 widget data [Implied]; D7 viewport [Stated, values Unstated], locale [Stated]; others none. **Side-effect class: None.** **C5: UI-only** [E3]. **C6: `UNKNOWN(not-tested)`**.
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all four.

Findings: none.
Risks: **R-98642-1** the same trigger and effect as R-98633-1 for the Nodes widget. [E1 marker, E3]
Knowledge gaps: K-1, K-2, K-3, K-9.
Open questions: **Q-98642-1** whether the Nodes widget exists in the build under test (NJM-86708 was not read).

### 3.12 NJM-98640: Repositories widget - Check UI

Case: NJM-98640  Area: Overview  Stratum: Repositories widget  (1 step)

**Intent: Presentation** [E1]. **C1: Executable.** Granularity: bundled. Feature-status references: none.
**C2: Absent.** Needs: values long enough to truncate and a stated viewport (E3). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.overview-panels, Structure: the heading Repositories was seen at the bottom edge; contents were not examined] K-2, K-3 |
| 1 | R: the specification page behind the link | P, **Ref** (gap (a)), NotV | NC, K-9 |

Decisive statements: 4. C7: 0 supported, 0 partly, 3 not covered, 1 not verifiable.

**C4:** D4 repository data [Implied]; D7 viewport [Stated, values Unstated], locale [Stated]; others none. **Side-effect class: None.** **C5: UI-only** [E3]. **C6: Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all four.

Findings: none. Risks: see R-98635-1. Knowledge gaps: K-1, K-2, K-3, K-9. Open questions: none beyond Q-98616-3.

## 4. C1 to C8 results by category (12 cases; counts per category, never a total)

| Criterion | Value | Cases | n |
|---|---|---|---|
| Intent (step 0) | Presentation | 98607, 98635, 98628, 98625, 98631, 98638, 98633, 98642, 98640 | 9 |
| | Mixed | 98644, 98616, 98655 | 3 |
| C1 | Executable | 98644, 98616, 98607, 98635, 98628, 98625, 98631, 98638, 98640 | 9 |
| | Partly executable | 98655, 98633, 98642 | 3 |
| | Not executable | none | 0 |
| C2 | Complete / N/A | none | 0 |
| | Partial | 98644, 98607 | 2 |
| | Absent | the other 10 | 10 |
| C3 (cases with a finding) | missing expected result | 98644 | 1 |
| | weak expected result | 98616 | 1 |
| | inconsistent or misleading content | 98655, 98633 | 2 |
| | no C3 finding | the other 8 | 8 |
| C3 property | limited verifiability (L, B, T with the scope stated) | all except 98644 | 11 |
| | reference-only presentation pointer (gap (a)) | 98616, 98655, 98635, 98628, 98625, 98631, 98638, 98633, 98642, 98640 | 10 |
| C4 side-effect class | None | all 12 | 12 |
| C5 | UI-only | all 12 | 12 |
| C6 (a case can hold several) | Data-dependent | 98644, 98616, 98607, 98635, 98628, 98625, 98631, 98638, 98640 | 9 |
| | Time-dependent | 98644, 98616, 98628 | 3 |
| | Transient-state | 98616 | 1 |
| | Repeatable | 98655 | 1 |
| | UNKNOWN(not-tested) | 98633, 98642 | 2 |
| C7 (62 decisive statements) | Supported | 98616 (3) | 3 |
| | Partly supported | 98616 (3) | 3 |
| | Contradicted | none | 0 |
| | Not covered | 98644 2, 98616 4, 98607 2, 98635 3, 98655 3, and 3 each in 98628, 98625, 98631, 98638, 98633, 98642, 98640 | 35 |
| | Not verifiable with current knowledge | 98644 2, 98616 6, 98607 1, 98635 1, 98655 4, and 1 each in 98628, 98625, 98631, 98638, 98633, 98642, 98640 | 21 |
| C8 case level, suitability | Needs human judgment | all 12 | 12 |
| C8 case level, readiness | Not applicable | all 12 | 12 |

## 5. Register (index; full text is in the per-case sections)

| Type | Count | Ids |
|---|---|---|
| Findings | 6 | F-98644-1, -2; F-98616-1; F-98655-1, -2; F-98633-1 |
| Risks | 7 | R-98644-1; R-98607-1; R-98616-1; R-98635-1; R-98655-1; R-98633-1; R-98642-1 |
| Knowledge gaps | 9 | K-overview-1 to -9 |
| Open questions | 10 | Q-98644-1; Q-98616-1 to -3; Q-98607-1; Q-98655-1, -2; Q-98633-1, -2; Q-98642-1 |

## 6. Automation suitability and readiness

**Case level (approved rules, applied literally): 0 automation candidates, 0 near candidates.** In every case at least one decisive statement is By judgment (L, B and T have no defined criteria) or Not verifiable (NJM-98644 has no expected result), so suitability is "Needs human judgment" for all 12 and readiness is Not applicable. The owner decision stands: no statement-level result makes a case a candidate.

**Statement-level observations (informational only):**

| Observation | Statements |
|---|---|
| Suitable at the UI level (10) | all in NJM-98616: A1, A3, A5, A6, A7, A8, A9, A10, A11, A12 |
| Ready (4) | NJM-98616 A6 (widget name), A7 (navigator text), A8 (starts on Monday), A9 (ends on Sunday) |
| Ready after information (1) | NJM-98616 A1 (sorted by date; needs activities on different dates) |
| Blocked: knowledge only, statement-level near candidates (5) | NJM-98616 A3, A5, A10, A11, A12 |
| Suitability `UNKNOWN` (1) | NJM-98655 P2 |
| Needs human judgment (51) | all other statements |

NJM-98616 is the only Overview case whose expected result carries objective, partly supported statements. As a case it still carries L, B, T, the open lists A2 and A4 and the FORMAT8 pointer, so it is not a candidate.

## 7. Cross-case consistency observations (secondary check; no C value was lowered because of them)

1. **Eight cases share identical text** (same action, same three-claim sentence) and differ only in the link. Each was judged on its own text; NJM-98633's link is the one that points to another widget (F-98633-1).
2. **Action says "screen", title says widget.** All "Check screen" cases scope the check differently in the title and in the action: Q-98616-3.
3. **Unimplemented markers.** NJM-98655, NJM-98633 and NJM-98642 all carry "to be implemented with NJM-86708". The status was not read: Q-98655-2, Q-98633-2, Q-98642-1. The markers sit in the description link (98633), in both links (98642) and in an example (98655), so the scope of the marker differs per case.
4. **State declarations.** Only NJM-98644 and NJM-98607 declare a state (volume, tenancy) in the title or action; no case has a pre-condition item. This matches Authentication and Activities.
5. **References between cases and areas.** NJM-98616 compares the Agenda with the Activities dashboard, the area analysed in `analysis-activities.md`, and with the Calendar dashboard, which no analysed area covers (K-overview-8). NJM-98655 mentions Node and Node tasks widgets, which are cases NJM-98642 and NJM-98633.
6. **Inventory precision.** `case-inventory.md` lists NJM-98616 as the only detailed Overview expectation and NJM-98655 as having a stray line; both are confirmed. This analysis adds that NJM-98607's expected result ends with a colon and no content, and that NJM-98655 has a second ambiguity (F-98655-2).
7. **Same weakness, different shape.** NJM-98644 has no expectation (a finding); the eight link cases have a generic sentence plus a pointer (properties). Each follows its own text and the 3.3 table.

## 8. Notes on the work done

- The case text is from the read-only Jira fetch of 2026-10-02. No comment or attachment was read, no link was followed, and no Jira case was changed.
- Category counts and the C7 totals (62 = 3 + 3 + 35 + 21) were checked against the per-case tables when this file was written.
