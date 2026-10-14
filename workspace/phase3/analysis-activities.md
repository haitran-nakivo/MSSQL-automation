# Phase 3: Activities analysis (milestone 3.4, Activities only)

Status: **DRAFT, awaiting owner review.** Date: 2026-10-02. Derived working material in `workspace/`, not part of the knowledge layer. Applies `analysis-rubric.md` (C1 to C8 unchanged, approved) and the evidence rules used for `analysis-authentication.md` (approved) to the 12 approved Activities cases of `selected-cases.md`. No numeric scores, no ranking, no total.

Sources used: the case text (E1, from the read-only Jira fetch of 2026-10-02: title, description, step action, expected result, label; no comments, no attachments, no enriched archives, no linked issues), and the reviewed knowledge documents `ui.activities` and `ui.activities-elements` (E2, cited by id and section). `ui.authentication-flows`, `ui.login` and `ui.auth-session` were not needed. No UI was explored. No Jira case was modified. No locators, code or scripts were written.

## 1. Owner decisions applied

- **The Phase 3.5 shortlist is case-level.** A Mixed case does not become a candidate because some statements are Ready. Statement-level observations are kept as informational evidence only.
- **The four rubric-table gaps** recorded for Authentication are not resolved and the rubric is unchanged. Each gap is checked below before the affected rule is applied (section 8).

## 2. Conventions (same as the Authentication analysis, plus what is specific to Activities)

1. Conventions 1 to 9 of `analysis-authentication.md` section 1 apply unchanged (statement ids, bare labels are not actions, binary acceptance rules, side-effect class from the steps as written, cross-case comparison as a secondary check only, letter-case ignored). Abbreviations are the same.
2. **The Activities expected-result sentence.** Every step has the same expected result: "The product UI shall be displayed in the installer's selected language, with no breaking UI, and reasonable truncation." Under rubric part 2, item 6 (split where a different observable property is named) it is **three statements per step**: **L** (language), **B** (no breaking UI) and **T** (reasonable truncation). This is the same split used for NJM-104803 in Authentication. Each is intent Presentation, C3: applicability P, presence Generic, verifiability By judgment. The element and the state under check are named by the title and the step (for example "Activities List for Running activities"), so the scope observed is stated, and under the 3.3 table each is the **property "limited verifiability"**, not a finding. The criteria for "breaking" and "reasonable" are not defined (Q-103495-1, shared by all cases). Counts of statements are therefore not comparable with the Authentication counts, where the sentence was shorter.
3. **Statements in the action field.** Where a step's action field holds a requirement (NJM-103524, 103529, 103530, 103538), the requirement is counted as a decisive statement (rubric part 2, item 6 counts statements in "a step action or expected result"). The misplacement of the expectation in the action field is recorded **once, under C1** (the action is not an action). It is not also recorded as a C3 finding.
4. **"Activities list"** in a case is read as the lists on `/c/activities` that `ui.activities` names **Running Activities** and **Past Activities**. A case that says "Activities dashboard" refers to the same screen (`ui.activities` calls it the Activities screen). No other mapping is assumed.
5. **Steps of the form "Check when there is ..."** name a state and a verb but no object. The object is taken from the title (E1), so they are actions with an identifiable target.
6. **Statement-level readiness of a case whose C1 is Not executable.** Rubric part 9 lists "C1 is Not executable" as the first readiness blocker. For the statement-level view this is applied to every statement of such a case (Blocked: case quality).

## 3. Knowledge gaps (shared by the cases, listed once)

Documents checked for every item: `ui.activities` (including Not verified) and `ui.activities-elements` (including Not verified).

| Id | Gap | Kind | Cases |
|---|---|---|---|
| K-activities-1 | Localization: the "installer's selected language" is not in the knowledge, and no document records the UI in another language | absent; unverified (the Authentication documents list other languages as not verified; the Activities documents record one language only) | all 12 |
| K-activities-2 | Running activities: row layout, status text, Stop control, and the details popup of a running activity (`ui.activities` Not verified: "Nothing about a running activity has been observed") | unverified | 103495, 103500, 103501, 103502, 103525 |
| K-activities-3 | Activity types other than the three name patterns observed (`Job run`, `Object recovery to ... VM`, `Self-backup into repositories`), and the popup of other types or statuses (listed as not verified) | absent; unverified | 103501, 103502 |
| K-activities-4 | Whether lists, popups, the search state and empty states break or truncate: only one truncated popup title (long name, ellipsis) is recorded | insufficient detail | 103496, 103497, 103500, 103501, 103502, 103524, 103525, 103526, 103529, 103530, 103538 |
| K-activities-5 | Search: the limit on results and how matching works (listed as not verified); the "common UI requirements for search" and "Common for the Product" that the case points to | unverified; absent | 103524 |
| K-activities-6 | Restart and its failure behavior (what Restart does is listed as not verified); removed Inventory items; the messages "{0} does not exist. Cannot restart this Activity." and "Disk is not mounted"; File Level Recovery, virtual mount, recovery server and the help-center link | unverified; absent | 103529, 103530, 103538 |
| K-activities-7 | The Past Activities list when it holds no activities (only the empty Running list is recorded) | absent | 103526 |

## 4. Per-case analysis

Selection order of `selected-cases.md` is kept. L, B, T are defined in convention 2. In the tables, step n is named by its action text.

### 4.1 NJM-103500: Type - Self-backup

Case: NJM-103500  Area: Activities  Stratum: Type  (3 steps)

**Intent (step 0): Presentation** [E1]: three display checks of Self-backup activities, labelled Localization.

**C1: Partly executable.** Step 1 ("Check Activities List for Self-backup type") is an action. Steps 2 and 3 ("Running activities details popup", "Past activities details popup:") are bare labels (convention 1). Granularity: one element per step. Feature-status references: none.

**C2: Absent.** Needs [E1/E3]: Self-backup activities in the Running state and in the Past state (E1: both popups); a popup that can be opened for each (E3). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 list entries of the type | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.activities, Past activity rows: the Self-backup name pattern and its icon are recorded; nothing about breaking or truncation] K-4 |
| 2 running activities details popup | L, B, T | same | L NV (K-1). B, T NV [E2: ui.activities, Not verified: nothing about a running activity] K-2 |
| 3 past activities details popup | L, B, T | same | L NV (K-1). B NC (K-4). **T Part** [E2: ui.activities, Details popup: the title of one Completed Self-backup popup is truncated with an ellipsis; whether the truncation is reasonable is not covered] |

Decisive statements: 9. C7: 0 supported, 1 partly supported, 3 not covered, 5 not verifiable.

**C4:** D1 none; D2 none; D3 none; D4 activities of the type in both states [Stated]; D5 a running activity is short-lived [Implied]; D6 none; D7 locale [Stated]; D8 producing a running activity starts a self-backup, effect `UNKNOWN(absent)`. **Side-effect class: None** (the steps only observe).
**C5: UI-only** [E3].
**C6: Transient-state** [E3, running state]; **Data-dependent** [E3, list contents].
**C8 case level:** **Needs human judgment** (all statements are By judgment). Readiness **Not applicable**. Statement-level view: Needs human judgment for all nine.

Findings: **F-103500-1** (C1): steps 2 and 3 are bare labels with no operation [E1].
Risks: none beyond R-103495-1 (running state).
Knowledge gaps: K-1, K-2, K-4.
Open questions: none beyond Q-103495-1.

### 4.2 NJM-103538: Error handling - Item removed, Activity restarted - File Level Recovery

Case: NJM-103538  Area: Activities  Stratum: Error handling  (2 steps)

**Intent: Mixed** [E1]: functional statements (what is shown when virtual mount fails or the recovery server does not respond) and presentation statements (message texts, link).

**C1: Not executable.** Both action fields are requirements that start with a condition: step 1 "a. If the Virtual Mount operation does not mount any disk and produces a NullPointerException, the following text shall be displayed instead of activity details: 'Disk is not mounted'", step 2 "b. If the recovery server does not exist, not powered on, no connection, etc the following error message shall be displayed: ...". No step says what to do. Feature-status references: **unimplemented** (step 2, "to be implemented with NJM-75711"; its link target is "TBD").

**C2: Absent.** Needs [E1/E3]: a File Level Recovery activity (E1 title); a virtual mount that mounts no disk and throws an error (E1); a recovery server that does not exist, is off or unreachable (E1); a removed item (E1 title). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | When virtual mount mounts no disk and fails with a NullPointerException, the text "Disk is not mounted" replaces the activity details | F+P, Spec, Obj | NC, K-6 |
| S2 | When the recovery server does not exist, is off or unreachable, the message "The recovery server does not respond. Please make sure the IP address is correct, the recovery server is powered on, and the connection is not blocked." is shown | F+P, Spec, Obj (the condition list ends with "etc.") | NC, K-6 |
| S3 | The message includes a help-center link "Learn more" with url "TBD" | P, Spec, **NotV** (the target is undefined); rubric gap (b), section 8 | NC, K-6 |
| L, B, T (step 1) | | rule 2 | L NV (K-1); B, T NC (K-4) |
| L, B, T (step 2) | | rule 2 | L NV (K-1); B, T NC (K-4) |

Decisive statements: 9. C7: 0 supported, 0 partly supported, 7 not covered, 2 not verifiable.

**C4:** D1 File Level Recovery, virtual mount, help center [Stated]; D2 the recovery server and the network [Stated]; D3 none; D4 a removed item [Stated in the title]; D5 none; D6 none; D7 locale [Stated]; D8 making a recovery server unreachable or a mount fail [Implied]. **Side-effect class: Irreversible or shared-environment impact** [E3]: a fault on a recovery server or its connection can affect other users, and an Inventory removal cannot be undone by the case.
**C5: UI with non-UI support** [E3]: the faults (a NullPointerException, a powered-off server, a blocked connection) are produced outside the web UI.
**C6: State-consuming** [E3, the item is removed].
**C8 case level:** **Needs human judgment** (L, B, T, S3). Readiness **Not applicable**.
Statement-level view: Suitable with non-UI support: S1, S2; **Blocked: case quality** (C1 is Not executable, convention 6), then knowledge, then environment. Needs human judgment: S3, L, B, T (both steps).

Findings: **F-103538-1** (C1): both action fields are conditions and requirements; there is no action and the expected-result fields hold only the generic sentence [E1]. **F-103538-2** (C3, inconsistent expected result, mismatched content): the title's trigger is an item removed from Inventory and an activity restarted, but conditions (a) and (b) are a failed virtual mount and an unreachable recovery server; neither mentions a removed item [E1].
Risks: **R-103538-1** trigger: producing the faults on a recovery server or its network; effect: other restores and users of that server are affected for the duration; scope: shared recovery infrastructure. [E3]
Knowledge gaps: K-1, K-4, K-6.
Open questions: **Q-103538-1** whether (a) and (b) are alternative causes of the same trigger or cases that belong elsewhere. **Q-103538-2** what the help-center link points to (the case says "TBD") and whether NJM-75711 is implemented (the issue was not read). **Q-103538-3** what the "etc." in (b) covers.

### 4.3 NJM-103524: UI - Activities List: Search button

Case: NJM-103524  Area: Activities  Stratum: UI  (2 steps)

**Intent: Mixed** [E1]: functional statements (search by name, live search, result limit) and presentation statements (the generic sentence).

**C1: Not executable.** Step 1's action field is a requirement list ("See common UI requirements for search / Shall allow to search for activities by name / Live search shall be available, for more information, see Common for the Product / The results shall be limited to 100"); "See ..." tells the tester to read a document, not to act on the UI. Step 2 ("Search no result") is a bare label. No step is an action. Feature-status references: none.

**C2: Absent.** Needs [E1/E3]: activities in the lists to search (E3); a search term that matches nothing (E1 step 2); more than 100 matching activities to observe the limit (E1, E3). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | Search finds activities by name | F, Spec, Obj (rule 4) | **Part** [E2: ui.activities, Search: typing filters the Past Activities list by name; the Running list was not observed] |
| S2 | Live search is available | F, Spec, Obj | **Part** [E2: ui.activities, Search: typing filters without pressing Enter; Past list only] |
| S3 | The results are limited to 100 | F, Spec, Obj (needs more than 100 activities) | NV [E2: ui.activities, Not verified: any limit on the number of results] K-5 |
| P1 | "See common UI requirements for search" | F, **Ref**: weak | NC, K-5 |
| P2 | "For more information, see Common for the Product" | F, **Ref**: weak | NC, K-5 |
| L, B, T (step 1) | | rule 2 | L NV (K-1); B, T NC (K-4) |
| L, B, T (step 2) | | rule 2 | L NV (K-1); B, T NC (K-4) |

Decisive statements: 11. C7: 0 supported, 2 partly supported, 6 not covered, 3 not verifiable.

**C4:** D1 none; D2 none; D3 none; D4 more than 100 matching activities, and a no-match term [Stated/Implied]; D5 none; D6 none; D7 locale [Stated]; D8 none. **Side-effect class: None.**
**C5: UI-only** [E1].
**C6: Data-dependent** [E3, results depend on the list contents].
**C8 case level:** **Needs human judgment** (L, B, T, P1, P2). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S1, S2, S3; **Blocked: case quality** (C1 is Not executable, convention 6), and for S3 also knowledge. Needs human judgment: P1, P2, and the six L, B, T statements.

Findings: **F-103524-1** (C1): the action field of step 1 holds requirements and the expected-result field holds only the generic sentence, and step 2 is a bare label; no step states an operation [E1]. **F-103524-2** (C3, weak expected result): P1 and P2 are pointers to other documents, not statements [E1].
Risks: **R-103524-1** trigger: running the search checks while other tests add or remove activities; effect: the result set changes, so the count and the limit cannot be repeated; scope: S1 to S3. [E3]
Knowledge gaps: K-1, K-4, K-5.
Open questions: **Q-103524-1** how the limit of 100 is observed (what is shown, and in which list). **Q-103524-2** what is expected in the "Search no result" step: the case states only the generic sentence, and the knowledge records a "No matching activities found" text, but an expectation is not taken from the knowledge (decision D1).

### 4.4 NJM-103495: General - Running State

Case: NJM-103495  Area: Activities  Stratum: General  (1 step)

**Intent: Presentation** [E1].

**C1: Executable.** The step ("Check Activities List for Running activities") is an action with an identifiable target. Granularity: one check. Feature-status references: none.

**C2: Absent.** Need: an activity in the Running state (E1). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NV [E2: ui.activities, Not verified: nothing about a running activity] K-2 |

Decisive statements: 3. C7: 0 supported, 0 partly, 0 not covered, 3 not verifiable.

**C4:** D1 none; D2 none; D3 none; D4 a running activity [Stated]; D5 the running state is short-lived [Implied]; D6 none; D7 locale [Stated]; D8 producing the activity starts a job or task, effect `UNKNOWN(absent)`. **Side-effect class: None.**
**C5: UI-only** [E3]. **C6: Transient-state** and **Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all three.

Findings: none.
Risks: **R-103495-1** trigger: producing a running activity for the check; effect: a job or task starts on the shared instance, and the running state may end before it is observed; scope: this case and every case that needs a running activity (103500, 103501, 103502, 103525, 103526). [E3]
Knowledge gaps: K-1, K-2.
Open questions: **Q-103495-1** the acceptance criteria for "no breaking UI" and "reasonable truncation" (the sentence defines neither; shared by all 12 cases).

### 4.5 NJM-103501: Type - Individual file download

Case: NJM-103501  Area: Activities  Stratum: Type  (3 steps)

**Intent: Presentation** [E1]. **C1: Partly executable**: step 1 ("Check Activities List for Individual file download type") is an action; steps 2 and 3 are bare labels. Granularity: one element per step. Feature-status references: none.
**C2: Absent.** Needs: file download activities in the Running and the Past state (E1). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 list entries of the type | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.activities: the name patterns observed do not include this type] K-3, K-4 |
| 2 running activities details popup | L, B, T | same | L NV (K-1). B, T NV [E2: ui.activities, Not verified: nothing about a running activity] K-2 |
| 3 past activities details popup | L, B, T | same | NV for all three [E2: ui.activities, Not verified: whether the popup shows other fields for other activity types or statuses] K-1, K-3 |

Decisive statements: 9. C7: 0 supported, 0 partly, 2 not covered, 7 not verifiable.

**C4:** D1 none; D2 none; D3 none; D4 activities of the type in both states [Stated]; D5 running state short-lived [Implied]; D6 none; D7 locale [Stated]; D8 producing a download activity, effect `UNKNOWN(absent)`. **Side-effect class: None.**
**C5: UI-only** [E3]. **C6: Transient-state**, **Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all nine.

Findings: **F-103501-1** (C1): steps 2 and 3 are bare labels with no operation [E1].
Risks: none beyond R-103495-1.
Knowledge gaps: K-1, K-2, K-3, K-4.
Open questions: none beyond Q-103495-1.

### 4.6 NJM-103529: Error handling - Item removed, Activity restarted - Vmware

Case: NJM-103529  Area: Activities  Stratum: Error handling  (1 step)

**Intent: Mixed** [E1]: the activity fails (functional) and a message is shown (presentation).

**C1: Not executable.** The only action field is a requirement ("the Activity shall fail and the following error message shall be displayed: {0} does not exist. Cannot restart this Activity. ..."); it says nothing to do. Feature-status references: **deprecated** ("file (to be deprecated with NJM-44053)") and **unimplemented** ("share (to be implemented with NJM-10583)").

**C2: Absent.** Needs [E1/E3]: an activity that contains an item (a VM, from the title) that was later removed from the Inventory (E1 title); the ability to restart that activity (E1 title). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | The activity fails when it is restarted after its item was removed from the Inventory | F, Spec, Obj | NV [E2: ui.activities, Not verified: what Restart does] K-6 |
| S2 | The message "{0} does not exist. Cannot restart this Activity." is shown, with {0} one of VM / instance / share / mailbox / OneDrive / site name / account / database / tape device / file | P, Spec with a placeholder, **Jdg** (which entry of {0} applies to this variant is not stated); rubric gap (b), section 8 | NV [E2: same] K-6 |
| L, B, T | | rule 2 | L NV (K-1); B, T NC (K-4) |

Decisive statements: 5. C7: 0 supported, 0 partly, 2 not covered, 3 not verifiable.

**C4:** D1 Inventory, restart [Stated]; D2 the VMware platform [Stated in the title]; D3 none; D4 a removed item and a restartable activity [Stated]; D5 none; D6 none; D7 locale [Stated]; D8 removing an Inventory item [Stated in the title]. **Side-effect class: Irreversible or shared-environment impact** [E3: the case has no step that restores the item, and other jobs may use it].
**C5: UI-only** [E3]. **C6: State-consuming** [E3]; **Data-dependent** [E3].
**C8 case level:** **Needs human judgment** (S2, L, B, T). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S1; **Blocked: case quality** (C1 is Not executable, convention 6), then knowledge, then environment. Needs human judgment: S2, L, B, T.

Findings: **F-103529-1** (C1): the only action field is a requirement; no action; the expected result holds only the generic sentence [E1]. **F-103529-2** (misleading content): the title names the VMware variant, but the step text lists every kind of item, including kinds of other platforms and kinds marked deprecated or to be implemented [E1]. **F-103529-3** (C1, feature status): the markers "(to be deprecated with NJM-44053)" and "(to be implemented with NJM-10583)" follow "file" and "share" with no separator, so the case does not say whether they mark two items or one ("file share") [E1].
Risks: **R-103529-1** trigger: removing an Inventory item to reach the state; effect: the item and its jobs are gone and the case has no way to bring them back; scope: the shared instance and other cases. [E3]
Knowledge gaps: K-1, K-4, K-6.
Open questions: **Q-103529-1** which value of {0} applies to this variant. **Q-103529-2** what the two markers refer to, and whether NJM-44053 and NJM-10583 are implemented (the issues were not read).

### 4.7 NJM-103525: UI - Activities list: Running Activities list

Case: NJM-103525  Area: Activities  Stratum: UI  (2 steps)

**Intent: Presentation** [E1]. **C1: Executable**: step 1 ("Check when there is/are activities running") and step 2 ("Check when there is no activities running") are actions with the target taken from the title (convention 5). Granularity: one state per step. Feature-status references: none.
**C2: Absent.** Needs: running activities for step 1 and an empty running list for step 2, in an order the case does not give (E1). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 running activities exist | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NV [E2: ui.activities, Not verified: nothing about a running activity] K-2 |
| 2 no running activities | L, B, T | same | L NV (K-1). B, T NC [E2: ui.activities, Layout: the empty Running list shows the text "There are no running activities." and a disabled select-all; breaking and truncation are not covered] K-4 |

Decisive statements: 6. C7: 0 supported, 0 partly, 2 not covered, 4 not verifiable.

**C4:** D1 none; D2 none; D3 none; D4 running activities, then none [Stated]; D5 the running state is short-lived [Implied]; D6 none; D7 locale [Stated]; D8 none stated. **Side-effect class: None.**
**C5: UI-only** [E3]. **C6: Transient-state**, **Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all six.

Findings: none.
Risks: **R-103525-1** trigger: running cases that need running activities (103495, 103500, 103501, 103502, 103525 step 1, 103526 step 1) and cases that need none running (103525 step 2) or no past activities (103526 step 1) on one instance; effect: the states the cases require conflict, so results depend on the order of the cases; scope: those cases. [E1 of each case, cross-case, section 6]
Knowledge gaps: K-1, K-2, K-4.
Open questions: none beyond Q-103495-1.

### 4.8 NJM-103496: General - Completed State

Case: NJM-103496  Area: Activities  Stratum: General  (1 step)

**Intent: Presentation** [E1]. **C1: Executable**: "Check Activities List for Completed activities" is an action with an identifiable target. Granularity: one check. Feature-status references: none.
**C2: Absent.** Need: a completed activity (E1). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.activities, Past activity rows: the Completed status badge is recorded; breaking and truncation are not covered] K-4 |

Decisive statements: 3. C7: 0 supported, 0 partly, 2 not covered, 1 not verifiable.

**C4:** D1 none; D2 none; D3 none; D4 a completed activity [Stated]; D5 none; D6 none; D7 locale [Stated]; D8 none. **Side-effect class: None.**
**C5: UI-only** [E3]. **C6: Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all three.

Findings: none. Risks: none. Knowledge gaps: K-1, K-4. Open questions: none beyond Q-103495-1.

### 4.9 NJM-103502: Type - Individual file recovery to source

Case: NJM-103502  Area: Activities  Stratum: Type  (3 steps)

**Intent: Presentation** [E1]. **C1: Partly executable**: step 1 ("Check Activities List for Individual file recovery to source type") is an action; steps 2 and 3 are bare labels. Granularity: one element per step. Feature-status references: none.
**C2: Absent.** Needs: file recovery to source activities in the Running and the Past state (E1). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 list entries of the type | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.activities: the name patterns observed (`Object recovery to "<name>" VM` among them) are not mapped to this type name] K-3, K-4 |
| 2 running activities details popup | L, B, T | same | L NV (K-1). B, T NV [E2: ui.activities, Not verified: nothing about a running activity] K-2 |
| 3 past activities details popup | L, B, T | same | NV for all three [E2: ui.activities, Not verified: whether the popup shows other fields for other activity types or statuses] K-1, K-3 |

Decisive statements: 9. C7: 0 supported, 0 partly, 2 not covered, 7 not verifiable.

**C4:** D1 none; D2 none; D3 none; D4 activities of the type in both states [Stated]; D5 running state short-lived [Implied]; D6 none; D7 locale [Stated]; D8 producing such an activity recovers files to their source location, effect `UNKNOWN(absent)`. **Side-effect class: None** (the steps only observe).
**C5: UI-only** [E3]. **C6: Transient-state**, **Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all nine.

Findings: **F-103502-1** (C1): steps 2 and 3 are bare labels with no operation [E1].
Risks: **R-103502-1** trigger: producing a "recovery to source" activity for the check; effect: files are written to the original location, which may change data on the source; scope: the source machine. [E3, from the title]
Knowledge gaps: K-1, K-2, K-3, K-4.
Open questions: **Q-103502-1** whether this type is the one the knowledge records as `Object recovery to "<name>" VM`, or a different type; the sources do not say.

### 4.10 NJM-103530: Error handling - Item removed, Activity restarted - Instance

Case: NJM-103530  Area: Activities  Stratum: Error handling  (1 step)

**Intent: Mixed** [E1]. Analysed on its own text; the text is identical to NJM-103529 (section 6).

**C1: Not executable.** The only action field is a requirement; no action. Feature-status references: **deprecated** ("file (to be deprecated with NJM-44053)") and **unimplemented** ("share (to be implemented with NJM-10583)").
**C2: Absent.** Needs [E1/E3]: an activity that contains an instance (from the title) that was later removed from the Inventory; the ability to restart it. Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | The activity fails when it is restarted after its item was removed from the Inventory | F, Spec, Obj | NV [E2: ui.activities, Not verified: what Restart does] K-6 |
| S2 | The message "{0} does not exist. Cannot restart this Activity." is shown, with {0} one of the listed kinds | P, Spec with a placeholder, **Jdg**; rubric gap (b), section 8 | NV [E2: same] K-6 |
| L, B, T | | rule 2 | L NV (K-1); B, T NC (K-4) |

Decisive statements: 5. C7: 0 supported, 0 partly, 2 not covered, 3 not verifiable.

**C4:** D1 Inventory, restart [Stated]; D2 the instance platform [Stated in the title, without naming it]; D3 none; D4 a removed item and a restartable activity [Stated]; D5 none; D6 none; D7 locale [Stated]; D8 removing an Inventory item [Stated in the title]. **Side-effect class: Irreversible or shared-environment impact** [E3, as NJM-103529].
**C5: UI-only** [E3]. **C6: State-consuming**, **Data-dependent** [E3].
**C8 case level:** **Needs human judgment** (S2, L, B, T). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S1; **Blocked: case quality** (convention 6), then knowledge, then environment. Needs human judgment: S2, L, B, T.

Findings: **F-103530-1** (C1): the only action field is a requirement; no action [E1]. **F-103530-2** (misleading content): the title names the instance variant, but the step text lists every kind of item [E1]. **F-103530-3** (C1, feature status): the two markers are not separated from "file" and "share" [E1].
Risks: **R-103530-1** the same trigger and effect as R-103529-1 for this variant. [E3]
Knowledge gaps: K-1, K-4, K-6.
Open questions: **Q-103530-1** which value of {0} applies to this variant. **Q-103530-2** what the markers refer to and whether NJM-44053 and NJM-10583 are implemented (not read).

### 4.11 NJM-103526: UI - Activities list: Past Activities list

Case: NJM-103526  Area: Activities  Stratum: UI  (2 steps)

**Intent: Presentation** [E1]. **C1: Executable**: both steps are "Check when ..." actions with the target taken from the title (convention 5). Granularity: one state per step. Feature-status references: none.
**C2: Absent.** Needs: a state with no past activities and at least one running activity (step 1), and a state with past activities (step 2) (E1). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 no past activities, some running | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.activities does not record the Past list when empty] K-4, K-7 |
| 2 past activities exist | L, B, T | same | L NV (K-1). B, T NC [E2: ui.activities, Layout and Past activity rows: the populated list is recorded; breaking and truncation are not covered] K-4 |

Decisive statements: 6. C7: 0 supported, 0 partly, 4 not covered, 2 not verifiable.

**C4:** D1 none; D2 none; D3 none; D4 no past activities with some running, then past activities [Stated]; D5 the running state is short-lived [Implied]; D6 a fresh or cleared history [Implied]; D7 locale [Stated]; D8 clearing the past activities for step 1 [`UNKNOWN(absent)`]. **Side-effect class: None** (the steps only observe).
**C5: UI-only** [E3]. **C6: Transient-state**, **Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all six.

Findings: none.
Risks: **R-103526-1** trigger: arranging "no past activities" on an instance that has history; effect: the history has to be removed (a Remove control exists, `ui.activities` Toolbar) and cannot be restored by the case; scope: the shared instance. [E3]
Knowledge gaps: K-1, K-4, K-7.
Open questions: none beyond Q-103495-1.

### 4.12 NJM-103497: General - Stopped State

Case: NJM-103497  Area: Activities  Stratum: General  (1 step)

**Intent: Presentation** [E1]. **C1: Executable**: "Check Activities List for Stopped activities" is an action with an identifiable target. Granularity: one check. Feature-status references: none.
**C2: Absent.** Need: a stopped activity (E1). Declared: none.

| Step | Statements | C3 | C7 |
|---|---|---|---|
| 1 | L, B, T | P, Gen, Jdg, scope stated (property) | L NV (K-1). B, T NC [E2: ui.activities, Past activity rows: the Stopped status badge is recorded; breaking and truncation are not covered] K-4 |

Decisive statements: 3. C7: 0 supported, 0 partly, 2 not covered, 1 not verifiable.

**C4:** D1 none; D2 none; D3 none; D4 a stopped activity [Stated]; D5 none; D6 none; D7 locale [Stated]; D8 producing a stopped activity means stopping a running one, effect `UNKNOWN(absent)`. **Side-effect class: None.**
**C5: UI-only** [E3]. **C6: Data-dependent** [E3].
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**. Statement-level view: Needs human judgment for all three.

Findings: none.
Risks: **R-103497-1** trigger: stopping a running activity to create the state; effect: the run is interrupted on the shared instance; scope: that activity and its job. [E3]
Knowledge gaps: K-1, K-4. Open questions: none beyond Q-103495-1.

## 5. C1 to C8 results by category (12 cases; counts per category, never a total)

| Criterion | Value | Cases | n |
|---|---|---|---|
| Intent (step 0) | Presentation | 103500, 103501, 103502, 103495, 103496, 103497, 103525, 103526 | 8 |
| | Mixed | 103538, 103524, 103529, 103530 | 4 |
| C1 | Executable | 103495, 103496, 103497, 103525, 103526 | 5 |
| | Partly executable | 103500, 103501, 103502 | 3 |
| | Not executable | 103538, 103524, 103529, 103530 | 4 |
| C2 | Complete / Partial / N/A | none | 0 |
| | Absent | all 12 | 12 |
| C3 (cases with a finding) | weak expected result | 103524 | 1 |
| | inconsistent or misleading content | 103538, 103529, 103530 | 3 |
| | missing (empty) | none | 0 |
| | no C3 finding | the other 8 | 8 |
| C3 property | limited verifiability (L, B, T with the scope stated) | all 12 | 12 |
| C4 side-effect class | None | 103500, 103501, 103502, 103524, 103495, 103525, 103496, 103526, 103497 | 9 |
| | Irreversible or shared-environment impact | 103538, 103529, 103530 | 3 |
| | Reversible / UNKNOWN | none | 0 |
| C5 | UI-only | all except 103538 | 11 |
| | UI with non-UI support | 103538 | 1 |
| C6 (a case can hold several) | Transient-state | 103500, 103501, 103502, 103495, 103525, 103526 | 6 |
| | Data-dependent | all except 103538 | 11 |
| | State-consuming | 103538, 103529, 103530 | 3 |
| C7 (78 decisive statements) | Supported | none | 0 |
| | Partly supported | 103500 (1), 103524 (2) | 3 |
| | Contradicted | none | 0 |
| | Not covered | 103496 2, 103497 2, 103500 3, 103501 2, 103502 2, 103524 6, 103525 2, 103526 4, 103529 2, 103530 2, 103538 7 | 34 |
| | Not verifiable with current knowledge | 103495 3, 103496 1, 103497 1, 103500 5, 103501 7, 103502 7, 103524 3, 103525 4, 103526 2, 103529 3, 103530 3, 103538 2 | 41 |
| | Out of knowledge scope | none | 0 |
| C8 case level, suitability | Needs human judgment | all 12 | 12 |
| C8 case level, readiness | Not applicable | all 12 | 12 |

The 41 not-verifiable statements include 22 language statements. Of the 78 statements, 66 are the L, B, T statements of 22 steps and 12 are other statements (S1 to S3 and P1, P2 of NJM-103524, S1 and S2 of NJM-103529 and NJM-103530, S1 to S3 of NJM-103538).

## 6. Cross-case consistency observations (secondary check; no C value was lowered because of them)

1. **Same expected-result sentence** in every step of all 12 cases. It adds two statements (B and T) to the language statement seen in Authentication, each with an undefined criterion (Q-103495-1).
2. **Duplicated step text.** NJM-103529 and NJM-103530 have identical step text; only the title differs (VMware, Instance). The text lists every kind of item, which does not fit either variant (F-103529-2, F-103530-2). Each was judged on its own text.
3. **Three variants of one trigger, inconsistent content.** NJM-103529, NJM-103530 and NJM-103538 share the title trigger "an item no longer exists and an Activity that contains it is restarted". The first two state the message for a missing item; NJM-103538 states two unrelated failure conditions (F-103538-2, Q-103538-1).
4. **Structurally identical cases.** NJM-103500, 103501 and 103502 have the same three steps and differ only in the activity type. Their C7 results differ only because the knowledge covers the Self-backup pattern and not the others (K-activities-3); that is a knowledge difference, not a case difference.
5. **Same wording, different shape.** The state cases use "Check Activities List for X activities" (103495, 103496, 103497) and "Check when there is ..." (103525, 103526). Both give an action with a target; no inconsistency.
6. **State declarations.** No case declares a pre-condition. The states the cases need conflict on one instance (running activities, no running activities, no past activities): R-103525-1.
7. **References.** NJM-103524 points to "Common for the Product" and to common UI requirements for search, as several Authentication cases point to Common documents. NJM-103529, 103530 and 103538 point to issue keys (NJM-44053, NJM-10583, NJM-75711) whose status was not read.
8. **Inventory precision.** `case-inventory.md` says message text sits in the action field of the error cases and that NJM-103524 has a requirement list in the action field. This analysis confirms both. It also records that the three error cases carry no instruction to perform any action.
9. **Cross-area note.** The language sentence in Authentication had one claim; here it has three. Nothing in Authentication was changed.

## 7. Automation suitability and readiness

**Case level (approved rules, applied literally and consistently with Authentication): 0 automation candidates, 0 near candidates.** In every case the B and T statements are By judgment (the criteria are not defined), and so is L, so rule 2 of the suitability table ("Needs human judgment") applies to all 12 and readiness is Not applicable. A case that needs human judgment is never a candidate. The owner decision (shortlist is case-level) is applied: no statement-level result changes this.

**Statement-level observations (informational only):**

| Observation | Statements |
|---|---|
| Suitable at the UI level (5) | NJM-103524 S1, S2, S3; NJM-103529 S1; NJM-103530 S1 |
| Suitable with non-UI support (2) | NJM-103538 S1, S2 |
| Needs human judgment (71) | the 66 L, B, T statements; NJM-103524 P1, P2; NJM-103529 S2; NJM-103530 S2; NJM-103538 S3 |
| Readiness of the 7 suitable statements | all **Blocked: case quality** (convention 6: C1 is Not executable in those four cases); behind that, knowledge (NV or NC for NJM-103524 S3, 103529 S1, 103530 S1, 103538 S1, S2) and environment (the three error cases) |
| Ready or Ready after information | none |

NJM-103524 S1 and S2 (search by name, live search) are the only statements that the knowledge partly supports and that need no destructive set-up. They are not Ready because the case has no action (F-103524-1). This is evidence about what a rewritten case could contain, not a classification; no case is changed in Phase 3.

Environment blockers: the three error cases (Inventory removal, fault injection), and the running-state cases (R-103495-1).

## 8. Rubric issues encountered

The four gaps recorded for Authentication were checked before the affected rule was applied. The rubric is unchanged; nothing was resolved by invention.

| Gap | Relevant to Activities? | How it was handled |
|---|---|---|
| (a) P statement that is Reference-only has no row in the C3 table | No. The pointers in NJM-103524 (P1, P2) are functional statements, which the table covers (F, Reference-only: weak) | n/a |
| (b) P statement that is Specific but By judgment or Not verifiable has no row | **Yes.** NJM-103529 and NJM-103530 S2 (the placeholder {0} with a list of possible values and no mapping to the variant) and NJM-103538 S3 (a help-center link whose url is "TBD") | Recorded as a property, not as a finding. Verifiability recorded as By judgment (S2) and Not verifiable (S3) so the statement-level view treats them as needing human judgment. No effect on the case level, where all cases already need human judgment. |
| (c) "Blocked: case quality" lists missing, inconsistent and contradictory expected results, not weak ones | Not applied: no readiness result depends on it at the case level, and the statement-level blocker here is C1 Not executable | n/a |
| (d) "Partly supported" is not a readiness blocker | Applied literally to NJM-103524 S1 and S2, but those statements are blocked by case quality anyway | n/a |

Further readings made in this milestone, recorded for the reviewer (none changes a criterion):

1. **Statements in the action field.** The rubric defines a statement as a claim "in a step action or expected result" but the C3 table speaks of the expected result. Where the functional expectation is in the action field and the expected result is generic (NJM-103524, 103529, 103530, 103538), the statement is counted and the misplacement is recorded once under C1 (convention 3). The rubric has no row for this situation.
2. **Splitting the generic sentence.** The Activities sentence names three properties; it was split into L, B, T (convention 2), as was done for NJM-104803.
3. **C1 "Not executable" at statement level.** Convention 6 applies the first readiness blocker to every statement of such a case; the rubric states it per case.
4. **"Check when ..." steps** were read as actions with the target from the title (convention 5).

## 9. Notes on the work done

- The case text is from the read-only Jira fetch of 2026-10-02 (title, description, steps, label; no comments or attachments). No Jira case was changed.
- Category counts and the C7 totals (78 = 0 + 3 + 34 + 41) were checked against the per-case tables when this file was written.
