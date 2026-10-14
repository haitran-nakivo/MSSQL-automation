# Phase 3: coverage and gap report and automation shortlist (milestone 3.5)

Status: **DRAFT, included in the Phase 3 audit (milestone 3.6).** Date: 2026-10-02. Derived working material in `workspace/`, not part of the knowledge layer. It consolidates `analysis-authentication.md`, `analysis-activities.md` and `analysis-overview.md` (the first two approved by the owner, the third produced in this run). Nothing here adds a criterion, a score or a ranking. Per decision D1 it identifies gaps and missing coverage and designs no test case. Per decision D3 and D6 it uses no live UI and no comments, attachments or enriched archives. No automation code, locators or scripts were written.

## 1. Basis and limits

| Item | Value |
|---|---|
| Cases analysed | 36 (12 per area), the approved selection; Authentication pool 51, Activities pool 45, Overview pool 51 |
| Evidence | E1 case text (Jira snapshot of 2026-10-02), E2 the reviewed `ui.*` documents, E3 derived and marked |
| Decisive statements | 258 (Authentication 118, Activities 78, Overview 62); counts are not comparable between areas because the expected-result sentence has one claim in some cases and three in others |
| Selection limit | The selection filters on Product = Core, a disabled legacy option (finding F1): 140 cases for the same screens are outside it. Statements below about "no case" mean "no case among the 36 selected", not "no case in Jira". |
| Knowledge limit | The knowledge documents record one lab instance (build 11.3.0.112329) at one viewport; Overview confidence is medium; nothing was verified in this phase |
| Spec limit | Confluence specifications are excluded (no valid tier for unreconciled specifications); links inside cases were not followed |

## 2. Quality of the 36 cases (counts per category)

| Criterion | Value | Authentication | Activities | Overview | All |
|---|---|---|---|---|---|
| C1 | Executable | 5 | 5 | 9 | **19** |
| | Partly executable | 6 | 3 | 3 | **12** |
| | Not executable | 1 | 4 | 0 | **5** |
| C2 | Complete | 0 | 0 | 0 | 0 |
| | Partial | 2 | 0 | 2 | **4** |
| | Absent | 10 | 12 | 10 | **32** |
| | N/A | 0 | 0 | 0 | 0 |
| Cases with at least one finding | | 10 | 7 | 4 | **21** |
| Findings (case level) | | 21 | 13 | 6 | **40** |
| C4 side-effect class | None | 3 | 9 | 12 | **24** |
| | Reversible | 1 | 0 | 0 | **1** |
| | Irreversible or shared-environment impact | 5 | 3 | 0 | **8** |
| | UNKNOWN(absent) | 3 | 0 | 0 | **3** |
| C5 | UI-only | 8 | 11 | 12 | **31** |
| | UI with non-UI support | 3 | 1 | 0 | **4** |
| | Non-UI | 0 | 0 | 0 | 0 |
| | UNKNOWN(ambiguous) | 1 | 0 | 0 | **1** |
| C7 (statements) | Supported | 6 | 0 | 3 | **9** |
| | Partly supported | 3 | 3 | 3 | **9** |
| | Contradicted | 0 | 0 | 0 | **0** |
| | Not covered | 44 | 34 | 35 | **113** |
| | Not verifiable with current knowledge | 65 | 41 | 21 | **127** |
| C8 case level | Needs human judgment | 12 | 12 | 12 | **36** |
| | any other value | 0 | 0 | 0 | 0 |
| Risks | | 16 | 9 | 7 | **32** |
| Open questions | | 25 | 11 | 10 | **46** |
| Knowledge gaps (per area) | | 12 | 7 | 9 | **28** |

Reading the table: 32 of 36 cases declare none of what they need (C2 Absent); 17 of 36 cases are not fully executable as written (C1 Partly executable 12, Not executable 5; the causes are bare-label or requirement steps and steps that depend on unimplemented features); the knowledge supports 9 of 258 decisive statements and partly supports 9 more, and contradicts none.

## 3. Test-case quality gaps (patterns, counts of cases)

These are deficiencies of the cases as written (findings). No case was changed and none is proposed.

| Pattern | Cases | Instances |
|---|---|---|
| The action field is a requirement, a condition or a bare label, so a step states no operation | Authentication 98483, 98477, 104803, 98494, 98479; Activities 103500, 103501, 103502, 103524, 103529, 103530, 103538 | 12 cases |
| Steps depend on a feature marked not implemented or deprecated (marker scope sometimes unclear) | 98472, 98473; 103529, 103530 (marker placement); Overview 98655, 98633, 98642 (property, no finding) | 7 cases |
| Expected result is only a pointer to another document or to a screen no selected case describes | 98472, 98477, 98494, 98479, 98473; 103524 | 6 cases (findings); a further 10 Overview statements are presentation pointers recorded as a property (rubric gap (a)) |
| Expected result without an observable outcome, with an undefined condition, with open lists, or with no stated scope | 98495, 98483, 98479, 98473, 104803; 98616 (open lists); 98644 (empty) | 7 cases |
| Mismatched, misleading or ambiguous content | 98472, 98496, 98491; 103529, 103530, 103538; 98655, 98633 | 8 cases |
| No pre-condition or test data although a state, data or environment is needed | all except those in which the need is nil | 32 cases (C2 Absent) plus 4 Partial |
| Every case carries a generic localization sentence with no defined criterion | all 36 (35 as a property, 1 as a finding because the scope is not stated, NJM-104803) | 36 cases |

## 4. Coverage gaps among the 36 selected cases (what the knowledge records and no selected case checks)

Identified from the reviewed knowledge documents against the selected cases. They describe gaps in the selection and in the cases; they do not create cases (D1).

| Area | Behavior recorded in the knowledge | Selected case that checks it |
|---|---|---|
| Authentication | Remember me (cookie, restore after restart, removal on sign-out) | none (known, finding F3); the login-screen default is checked as a statement in NJM-98473 |
| | Sign-out menu, Log out landing on the login page, Back and direct paths after sign-out | none; NJM-104803 is the "Profile" entry only |
| | Unauthenticated access to protected paths, session persistence across reload and a second tab, `/c/login` while signed in | none |
| | Enter in Password signs in | none |
| | Session cookie attributes | none (not UI cases) |
| Activities | Toolbar enabling by selection (Restart, Stop and Remove) | none; NJM-103524 covers search only |
| | Status badges and colors; Date format; newest-first order; row hover "…" | none |
| | Details popup fields (Started, Status, Initiated by) | only through the generic sentence of the three Type cases |
| | Search no-result text and its effect on the toolbar | NJM-103524 step 2 names the state but states no expectation |
| Overview | Sidebar items and the Settings badge | none |
| | Banners (license, new version) | none |
| | Seven summary counters | NJM-98607 only for the 999+ alarm |
| | Events table, search and filter | NJM-98644 (very large data volume, empty expectation) |

Behaviors the cases cover and the knowledge does not: all two-factor, password-reset, wrong-credentials, tenancy, first-run, browser-compatibility, start-screen and Profile statements; Activities types other than Self-backup, running activities, restart errors; the Overview widgets Backup size, Total backup storage, Node tasks, Nodes, and the Agenda arrows (section 5).

## 5. Knowledge gaps (28 per-area items, grouped by theme)

| Theme | Items | What is missing |
|---|---|---|
| Localization | K-authentication-1, K-activities-1, K-overview-1 | the "installer's selected language", and any observation of the UI in another language |
| Presentation robustness | K-authentication-11, K-activities-4, K-overview-2 | whether screens break or truncate; footer content; other viewports, zoom levels and resolutions |
| Specification pointers and common requirements | K-authentication-10, K-activities-5 (common part), K-overview-9 | "Common for the Product", "Common UI - Password Input", FORMAT8, Figma samples, widget pages behind links |
| States the lab cannot show without set-up | K-activities-2, K-activities-7, K-overview-5, K-overview-6, K-overview-7 | running activities, empty Past list, very large event volumes, 999+ alarms, permission-restricted users |
| Authentication behavior families | K-authentication-2, -3, -4, -5, -6, -7, -8, -9, -12 | two-factor, wrong credentials and lockout, password reset beyond the first view, tenancy and roles, first-run screens, browser compatibility, start screen, Profile, product emails |
| Activities behavior families | K-activities-3, K-activities-5 (search limit), K-activities-6 | other activity types and their popups, the 100-result limit, Restart and its error messages, File Level Recovery |
| Overview behavior families | K-overview-3, K-overview-4, K-overview-8 | widgets not recorded, widget behavior (Agenda arrows, Today, legend, paging), Agenda against the Activities and Calendar dashboards |

Kinds: absent for most items, unverified where a document lists the topic as not verified, insufficient detail for K-authentication-11 and K-activities-4. No item is a contradiction.

## 6. Open questions (46), by kind of answer needed

| Kind | Examples |
|---|---|
| Definitions the case never gives | acceptance criteria for "no breaking UI" and "reasonable truncation" (Q-103495-1); what FORMAT8 is (Q-98616-1); what "invalid" means (Q-98479-2); the condition behind "accordingly" (Q-98495-3, Q-98473-3); loading-time acceptance (Q-98644-1) |
| Screens named but not described | what C2 shows and how long it lasts (Q-98477-1); the "B3 screen below" (Q-98494-1); the help-center link, "TBD" (Q-103538-2) |
| Wording that the sources read in two ways | "disabled" in J1 (Q-98491-1); empty UI and a text (Q-98655-1); the stray condition (Q-98655-1); the link to the wrong widget (Q-98633-1) |
| Differences between a case and the knowledge | the Forgot link wording (Q-98473-1, Q-98479-1); the show/hide toggle on the login field (Q-98473-4) |
| Feature status not read | NJM-11650, NJM-14438, NJM-51374 (Authentication); NJM-44053, NJM-10583, NJM-75711 (Activities); NJM-86708 (Overview) |
| Set-up and state | how the starting state is produced (Q-98516-1); which activity name pattern is "recovery to source" (Q-103502-1); which browsers are unsupported (Q-98512-1) |

## 7. Automation shortlist (case level, no code)

**Rule applied (approved rubric part 9 and the owner decision):** a candidate has suitability "Suitable at the UI level" or "Suitable with non-UI support" and readiness "Ready" or "Ready after information"; a near candidate has the same suitability and is blocked only by knowledge; a case that needs human judgment is never a candidate. The shortlist is case-level.

**Result:**

| Class | Cases |
|---|---|
| Automation candidates | **none** |
| Near candidates | **none** |
| Needs human judgment (not shortlisted) | all 36 |
| Not UI-automation scope | none |

**Why, stated once for all 36 cases.** Every case contains at least one decisive statement whose acceptance criterion is not defined: the generic sentence (language, and in Activities and Overview also "no breaking UI" and "reasonable truncation") has verifiability By judgment, and NJM-98644 has no expected result at all. The first rule of the suitability table that applies is therefore "Needs human judgment", and readiness is Not applicable. This is a consequence of what the 36 cases are: every one carries the label Localization and was derived from a specification section (finding F4), so they are presentation checks by design.

**Blockers behind the result, by cause (not a ranking):**

| Cause | Cases |
|---|---|
| The generic sentence has no acceptance criterion | all 36 |
| No action in the step (C1 Not executable) | 104803; 103524, 103529, 103530, 103538 |
| Missing expected result | 98644 |
| Knowledge does not cover the behavior (Not covered or Not verifiable) | all 36 (every case has at least one such statement; the language statement alone is Not verifiable) |
| Irreversible or shared-environment side effect | 98472, 98516, 98477, 98494, 98496, 103529, 103530, 103538 |
| Undeclared state, data or environment | 32 Absent, 4 Partial |

**Statement-level evidence (informational and refactoring evidence; none of it makes a case a candidate):**

| Result | Statements | Where |
|---|---|---|
| Ready | 10 | NJM-98473 (6: Username focus, Username and Password placeholders, Remember me unchecked, Log In disabled when Username is empty, Forgot link opens D1); NJM-98616 (4: widget name, navigator text, starts on Monday, ends on Sunday) |
| Ready after information | 2 | NJM-98479 (reset-input placeholder); NJM-98616 (sorted by date) |
| Near candidates (blocked only by knowledge) | 8 | NJM-98473 (2: empty by default), NJM-98479 (1: link shows G1), NJM-98616 (5: Agenda equals Activities dashboard, equals Calendar, right arrow, left arrow, Today) |
| Blocked: case quality | 11 | NJM-98496 (4), and the 7 suitable statements of NJM-103524, 103529, 103530, 103538 |
| Blocked: knowledge (other suitable statements) | the rest | two-factor, wrong credentials, tenancy, first-run, password reset, email, restart errors |

Knowledge that would have to exist before any statement above could be automated is listed in section 8. Nothing in this report writes code, locators or scripts.

## 8. Knowledge needed before automation (by area, grouped, not ranked)

| Area | Needed before the statement-level blocked items could be considered |
|---|---|
| Authentication | observation of the wrong-credentials screen, the C2 screen and the lockout rule (K-3); the password-reset sequence and what DONE does (K-4); two-factor screens (K-2); the Create User Account and Configuration Wizard screens (K-6); the footer (K-11); the common field requirements (K-10); tenancy and roles (K-5) |
| Activities | running activities and their popup (K-2); the other activity types and their popups (K-3); the result limit and matching rules of the search (K-5); Restart and its error messages (K-6); the empty Past list (K-7); robustness of lists and popups (K-4) |
| Overview | the Agenda arrows, Today and the legend (K-4); the comparison of the Agenda with the Activities and Calendar dashboards (K-8); the widgets that are not recorded (K-3); the summary-bar alarms (K-6); permission-restricted content (K-7); loading and the large Events volume (K-5); other viewports (K-2) |
| All | the language behavior of the UI (K-1 of each area); the definition of the presentation criteria and of FORMAT8 (open questions, not obtainable from the allowed sources) |

Per decision D6 none of this was verified in Phase 3. Each item would need either live verification or a decision on a specification source, both of which are outside Phase 3.

## 9. Observations on the method (recorded, nothing changed)

The four rubric-table gaps recorded in `analysis-authentication.md` (section 9) and the four readings added in `analysis-activities.md` (section 8) are the full list of issues met in applying the rubric. In summary:

| Item | Where it mattered |
|---|---|
| (a) A presentation statement that is Reference-only has no row in the C3 table | Authentication (3 cases), Overview (10 statements in 10 cases) |
| (b) A presentation statement that is Specific but By judgment or Not verifiable has no row | Authentication (NJM-98491, "highlighted"), Activities (103529, 103530, 103538) |
| (c) "Blocked: case quality" does not list weak expected results | no readiness result depended on it |
| (d) "Partly supported" is not a readiness blocker | statement-level view only |
| Statements in the action field | Activities (4 cases) |
| Splitting the generic sentence into L, B and T | Activities, Overview, NJM-104803 |
| C1 Not executable applied to every statement at statement level | Activities (4 cases) |

The rubric is unchanged. None of these items changed a case-level result: the case-level result of every case is decided by the generic sentence, which the 3.3 table handles.

## 10. Reproducibility

Counts in this report were taken from the three analysis files. The audit (milestone 3.6, `phase3-audit.md`) re-computes them from the files and records the check.
