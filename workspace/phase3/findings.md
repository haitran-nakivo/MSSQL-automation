# Phase 3: findings log

Status: running log, DRAFT. Date opened: 2026-10-02. Findings are recorded here as the owner instructed; none of them changes the approved scope or selection method.

| # | Finding | Source | Effect |
|---|---|---|---|
| F1 | The Jira Product option `Core` is flagged disabled (a legacy value); a separate `Core (general)` option is active. Filtering on `Product = Core` finds the spec-derived cases created in 2026 and hides older cases for the same screens whose Product is empty, `Core (general)` or another value (140 cases match the family phrases). This is a coverage blind spot. | 3.1, owner decision R1 | Scope kept unchanged. The blind spot is carried into the coverage report. |
| F2 | NJM-98644 (Overview Events widget, 100,000 to 500,000 events) is selected by the key-ascending tie-break. Its expected result is empty and it needs a very large data volume, so it is atypical. | 3.1 and 3.2, owner decision R2 | Selection unchanged; the case is analysed and flagged as special. |
| F3 | The Core pool has no Remember me case and only two logout cases. The Phase 2 knowledge documents Remember me and the sign-out flow, so the Core family does not cover them. | 3.1, owner decision R4 | Selection unchanged. Reported as a coverage gap. |
| F4 | All 36 selected cases are localization checks derived from spec sections; 23 have no functional expectation (22 generic, 1 empty). | 3.2 | Affects how much the cases can say about behavior; to be treated in the rubric (3.3) and the analysis (3.4). |
| F5 | No selected case has a pre-condition or test data; 26 need a state, data or environment they do not record. | 3.2 | Affects automation suitability. |
| F6 | 8 selected cases refer to features marked to be implemented or deprecated; NJM-98472 tells the tester to abort some steps. | 3.2 | Those cases are partly not executable as written. |
| F7 | Content defects: NJM-98633 (link to another widget), NJM-98655 (stray line), NJM-103529 and NJM-103530 (same step text across variants), Activities error cases with the message text in the action field. | 3.2 | Test-case quality gaps for the report. |

## Milestone 3.4, Authentication (2026-10-02, draft, awaiting review)

Per-case findings are in `analysis-authentication.md` (ids `F-<key>-n`). Pattern-level findings for the 12 Authentication cases (21 case-level findings in 10 cases; NJM-98512 and NJM-98516 have none):

| # | Finding | Cases |
|---|---|---|
| F8 | The action field is a requirement, a condition or a bare label, so the case states few or no actions. | 98483, 98477, 104803, 98494, 98479 |
| F9 | Steps depend on features the case marks as not implemented, and the scope of the marker is not always clear. | 98472, 98473 |
| F10 | Expected results that are only pointers to other documents or to screens that no case describes. | 98472, 98477, 98494, 98479, 98473 |
| F11 | Expected results with no observable outcome, an undefined condition, or no stated scope. | 98495, 98483, 98479, 98473, 104803 |
| F12 | Mismatched or ambiguous wording (existing-password statements on a create screen, email statements under a screen step, "disabled" for "displayed"). | 98472, 98496, 98491 |
| F13 | No Authentication case has C7 support for more than a few statements: 6 supported, 3 partly supported, 44 not covered, 65 not verifiable of 118 decisive statements. | all 12 |

## Milestone 3.4, Activities (2026-10-02, draft, awaiting review)

Per-case findings are in `analysis-activities.md` (ids `F-<key>-n`): 13 findings in 7 cases; NJM-103495, 103496, 103497, 103525 and 103526 have none. Pattern-level:

| # | Finding | Cases |
|---|---|---|
| F14 | Bare-label steps: the case has one action and two labels ("Running activities details popup"). | 103500, 103501, 103502 |
| F15 | The action field holds requirements or conditions, no step states an operation, and the expected result is only the generic sentence. | 103524, 103529, 103530, 103538 |
| F16 | Expected results that are only pointers to other documents. | 103524 |
| F17 | Misleading content: title names one platform and the step text lists all item kinds (103529, 103530); title trigger does not match the step conditions (103538); deprecation and implementation markers not separated from the items (103529, 103530). | 103529, 103530, 103538 |
| F18 | Every Activities case carries the same three-claim sentence with no criteria for "breaking" or "reasonable"; 12 of 12 are limited-verifiability (property); none is a case-level candidate. | all 12 |

## Milestone 3.4, Overview, and 3.5 (2026-10-02)

Per-case findings are in `analysis-overview.md`: 6 findings in 4 cases (NJM-98644, 98616, 98655, 98633); the other 8 cases have none. Pattern-level:

| # | Finding | Cases |
|---|---|---|
| F19 | Missing expected result and an open-ended action for a performance and volume check. | 98644 |
| F20 | Open-ended lists ("etc..") in an otherwise detailed expectation, so completeness cannot be decided. | 98616 |
| F21 | Mismatched or ambiguous content: a stray condition about nodes under a permissions title; "empty UI" followed by a text; a link to another widget. | 98655, 98633 |
| F22 | Eight "Check UI" cases are identical apart from a link to a specification page, which cannot be decided from the allowed sources (presentation pointers, a property under rubric gap (a)). | 98635, 98628, 98625, 98631, 98638, 98633, 98642, 98640 |
| F23 | Phase 3 result: 40 case-level findings in 21 of 36 cases; 9 of 258 decisive statements supported, 9 partly supported, none contradicted; every case needs human judgment, so the case-level shortlist is empty. | all 36 |
