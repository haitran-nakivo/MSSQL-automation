# Phase 3: scope and selection method (milestone 3.1)

Status: **APPROVED by the owner on 2026-10-02** (R1 to R4 accepted without change; the limitations in section 10 are recorded as findings in `findings.md`). Date: 2026-10-02. Derived working material in `workspace/`, not part of the knowledge layer. The result of applying this method is in `selected-cases.md`.

## 1. Scope

Analyze **existing** manual Xray test cases in Jira project NJM for three areas only: **Authentication**, **Activities** and **Overview**. No new test cases are designed. Gaps and missing coverage may be identified in later milestones, but not filled. Decisions D1 to D7 of the owner (2026-10-02) govern this phase; they are recorded in `PROJECT_STATUS.md`.

## 2. Sources and access

- Read-only Jira/Xray queries only.
- **Read in 3.1:** issue keys, titles and metadata values. **Read from 3.2 on:** the manual steps of the selected cases, as text.
- **Never read or recorded:** Jira comments, attachments, the QA AI enriched-case archives, lab hosts, accounts or passwords. If a step contains such a value it is not copied; the case is noted.
- No UI exploration and no live verification. Anything the Phase 2 knowledge cannot confirm becomes a recorded gap.

## 3. Fields used

| Field | Jira id | Use |
|---|---|---|
| Issue type | n/a | "Post-EA - Test Case" |
| Test Type | cf[10700] | Manual |
| Steps Count | cf[10706] | at least 1 |
| Product | cf[11401] | `Core` |
| Status | n/a | not Closed |
| Regression scope | cf[11600] | recorded (all pooled cases have Yes) |
| Automation scope | cf[11601] | recorded (all pooled cases have Planned) |

The Test Repository Path field is not searchable in JQL, so it cannot be used as a filter.

## 4. Area definitions (title families)

An area is the set of cases whose title **starts with** the family phrase. The families follow the screen names used by the Phase 2 knowledge and are mutually exclusive.

| Area | Title starts with |
|---|---|
| Authentication | `Login page`, `Logout section`, `Log out section` |
| Activities | `Activities dashboard` |
| Overview | `Overview dashboard` (never `Job Overview ...` or `Group Dashboard ...`) |

## 5. Eligibility criteria (all must hold)

- E1: project NJM and issue type "Post-EA - Test Case".
- E2: Test Type = Manual.
- E3: Steps Count at least 1 (there are steps to analyze).
- E4: Product = Core.
- E5: status is not Closed.
- E6: the title starts with the area's family phrase (applied after the query, because JQL text search matches anywhere in the title).

JQL base: `project = NJM AND issuetype = "Post-EA - Test Case" AND cf[10700] = Manual AND cf[10706] >= 1 AND cf[11401] = Core AND status != Closed`

Family clause appended per area, each phrase **in quotes**:

- Authentication: `AND (summary ~ "\"Login page\"" OR summary ~ "\"Logout section\"" OR summary ~ "\"Log out section\"")`
- Activities: `AND summary ~ "\"Activities dashboard\""`
- Overview: `AND summary ~ "\"Overview dashboard\"" AND NOT summary ~ "\"Job Overview\""`

Always order by `key ASC`. **Phrases must be quoted:** an unquoted multi-word term is searched as separate words and returns far too many cases (see section 8).

## 6. Selection algorithm (deterministic)

Target: **12 cases per area**, inside the approved 10 to 15.

1. **Pool:** the cases satisfying E1 to E6 for the area.
2. **Stratum:** the topic words directly after the family phrase, up to the first `:` or ` -` (for example "Two-factor authentication", "Events widget", "UI"). Both logout titles form the stratum "Logout section".
3. **Stratum order:** by pool size, largest first; ties by name, alphabetically.
4. **Round-robin:** take one case from each stratum in that order, then repeat, until 12 are chosen or the pool is exhausted.
5. **Order inside a stratum:** by Steps Count, highest first; ties by issue key, ascending.

Same snapshot plus the same rules gives the same list.

## 7. Result

| Area | Pool | Strata | Selected |
|---|---|---|---|
| Authentication | 51 | 9 | 12 |
| Activities | 45 | 4 | 12 |
| Overview | 51 | 12 | 12 |

All pooled cases have Regression scope = Yes and Automation scope = Planned. The 36 selected cases are listed in `selected-cases.md`.

## 8. Counts measured on 2026-10-02 (read-only, metadata only)

- **Correction of the milestone 3.0 sizing.** The login figure given then (about 1,700) was wrong: multi-word terms had not been quoted. With quoted phrases, test cases whose title mentions login, logout or Remember me number 290 (Manual), 271 of them with steps; 86 of those have Regression scope = Yes, 11 Train Ready scope = Yes, and 16 Automation scope = Yes. The Activities (about 3,000) and Overview/dashboard (about 2,100) figures were single-word title matches over all products and are not eligibility counts.
- With the section 5 criteria: Authentication 50 `Login page` cases plus 2 logout cases (51 after the prefix rule), Activities 45, Overview 52 (51 after the prefix rule).
- Closed cases with Product = Core in these families: 0.
- The same five family phrases with Product other than Core or empty, Manual, with steps, not Closed: **140** cases (excluded by E4).

## 9. Exclusions

- Product other than Core (MSP, M365, Virt./Cloud Comp., Physical, FNB, DBs/Services/Apps, Core (general) and empty). Reason: the Phase 2 knowledge does not cover those editions or platforms.
- `Job Overview Dashboard` and `Group Dashboard` cases: a different screen from the Overview page.
- Cases without steps, non-Manual cases, Closed cases (none in the pool).
- Cases that mention an area word elsewhere in the title but do not start with the family phrase.
- Jira comments, attachments, the QA AI enriched archives and any lab secrets.
- Confluence specification content: not used, because the tier rule for unreconciled specifications is undecided.

## 10. Limitations to review

1. **Product = Core is a legacy value.** The `Core` option is flagged disabled in Jira, and a separate `Core (general)` option is active. The filter finds the spec-derived cases created in 2026, and it hides older cases for the same screens whose Product is empty, `Core (general)` or another value (140 cases match the family phrases). They are a coverage blind spot.
2. **The tie-break can pick edge cases.** Ascending key first picks, for the Overview Events widget, NJM-98644 (a very large data volume case), which is not a typical case.
3. **Authentication is dominated by topics outside the knowledge** (two-factor authentication, password reset and similar), so the selection is rich in gap probes. Logout is represented by two cases and Remember me by none with Product = Core.
4. **Regression scope and Automation scope do not discriminate**: every pooled case has Yes and Planned.
5. **Titles follow a naming convention.** Family detection relies on it.
6. **Jira data can change.** The snapshot date and the JQL above are the reproducibility anchor.

## 11. Evidence rules for the next milestones

- May be recorded: keys, titles (as identifiers), metadata values, counts, and **paraphrased** steps and expected results.
- Not recorded: comments, attachments, credentials, hostnames, or verbatim step text beyond a short identifying fragment.
- A statement of a case is "supported" only if a reviewed Phase 2 knowledge document confirms it. Otherwise it is a gap. Spec-derived expectations that the knowledge does not confirm stay unresolved.
- Derived analysis lives in `workspace/`. Whether any case summaries go to `qa/` is decided at 3.2.

## 12. Questions for the reviewer

- R1: accept `Product = Core` (with the 140-case blind spot), or widen it?
- R2: accept the key-ascending tie-break, or replace it (for example by Steps Count only, or by a fixed list of preferred title fragments)?
- R3: accept 12 per area?
- R4: accept the Authentication families (`Login page`, `Logout section`), knowing that Remember me has no Core case?
