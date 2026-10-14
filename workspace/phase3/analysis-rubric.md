# Phase 3: analysis rubric (milestone 3.3)

Status: **APPROVED by the owner on 2026-10-02** (C1 to C8 unchanged; one clarification added in part 11, item 9). Date: 2026-10-02. Derived working material in `workspace/`, not part of the knowledge layer.

The rubric is generic. It is written for any manual Xray test case and any area, not for the 36 selected cases. It uses categories and decision rules, **not numeric scores or rankings**. Counts may be reported per category, but no total score is ever computed.

## 1. Structure

| Part | Content |
|---|---|
| 2 | Principles and evidence rules |
| 3 | Representing unknown information |
| 4 | Step 0: the intent type of a case |
| 5 | The eight criteria, C1 to C8 |
| 6 | Findings, risks, knowledge gaps and open questions kept apart |
| 7 | Localization and other non-functional cases |
| 8 | Unknown or insufficient knowledge |
| 9 | Automation suitability and readiness, without code |
| 10 | The analysis record used for each case in 3.4 |
| 11 | Consistency checks |
| 12 | Hypothetical examples |

## 2. Principles and evidence rules

1. **One value per criterion, from a closed list.** Every value cites evidence or is `UNKNOWN`.
2. **Evidence tags.**
   - **E1:** stated in the case (title, description, step action, data, expected result, pre-condition, label, link).
   - **E2:** stated in a reviewed Phase 2 knowledge document (cite its id).
   - **E3:** derived by reasoning from E1 and E2. The reasoning is written down. A derived value can never make a statement "Supported".
3. **Sources allowed:** the case and the reviewed Phase 2 knowledge only (decisions D3 and D6). No live UI, no comments, no attachments, no enriched archives, no Confluence specifications.
4. **A value describes the case as written**, not the intent of its author and not what a rewritten case could be.
5. **Neutral properties are kept apart from deficiencies** (part 6). A property is a neutral description. It becomes a finding only when it breaks a stated requirement of the criterion for that case's intent type.
6. **Atomic statements.** A *statement* is one separately checkable claim in a step action or expected result. Split a text wherever it names a different element, a different state or a different observable property. A *decisive* statement is one whose outcome would decide pass or fail of the case.

## 3. Representing unknown information

| Value | Use |
|---|---|
| `UNKNOWN(absent)` | The information is not in the sources allowed. |
| `UNKNOWN(not-tested)` | It can only be established by running something, which D6 excludes. |
| `UNKNOWN(ambiguous)` | The source can be read in more than one way, and the readings give different values. |
| `N/A(reason)` | The criterion does not apply. The reason is written (for example "no state needed beyond a running product"). |

`UNKNOWN` is a valid, final value in 3.4. It is never replaced by a guess, and it is never counted as a good or a bad value. `N/A` is not `UNKNOWN`.

## 4. Step 0: intent type

Classify what the case sets out to check, from its title, description, steps, label and expected results. Do this **before** judging anything else. Quality does not decide the intent.

| Intent type | The case sets out to check |
|---|---|
| Functional | behavior, a state change or an outcome of an action |
| Presentation | appearance, layout, wording, language, truncation or display of data |
| Non-functional | performance or load, compatibility, security or limits |
| Mixed | more than one of the above, in separate steps or statements |
| `UNKNOWN(ambiguous)` | the sources do not allow a decision |

A **Mixed** case gets an intent type per statement, and criteria C3 and C8 are evaluated per statement.

## 5. Criteria

### C1. Step clarity and executability

A step is an **action** when it says what to do to which element or state. A step phrased as a requirement ("X shall ..."), a condition, or a message text is a **statement**, not an action.

| Value | Rule |
|---|---|
| Executable | every step is an action, the target is identifiable, the order is unambiguous |
| Partly executable | at least one step is an action and at least one step is a statement, has an unidentifiable target, or depends on something the case itself marks as not yet available |
| Not executable | no step is an action |
| `UNKNOWN(ambiguous)` | the steps cannot be read consistently |

Neutral attributes, recorded but not judged: **granularity** (one check per step, or several checks bundled in a step) and **feature-status references** (none, refers to an unimplemented feature, refers to a deprecated feature).

### C2. Pre-conditions, state and test data

First list the **needs**: the states, data, roles, configuration or accounts a tester must have to perform the steps and observe the expected results. Derive the list from the steps and expected results, tag it E1 or E3, and then compare it with what the case **declares** (a pre-condition item, step text or data field).

| Value | Rule |
|---|---|
| Complete | every need is declared |
| Partial | some needs are declared, some are not |
| Absent | needs exist and none is declared |
| N/A | the case needs nothing beyond a running product and a known signed-in user |
| `UNKNOWN(absent)` | the needs cannot be derived from the sources |

Record the list of undeclared needs; it is the evidence.

### C3. Expected-result quality and verifiability

Evaluate three separate attributes for each decisive statement.

**C3a. Applicability.** What kind of expectation does the intent require?
- **F:** a functional expectation (an observable outcome or state).
- **P:** a presentation or non-functional expectation (what is observed, in which scope, and by what acceptance criterion).
- **None:** no expectation is required (an observation-only or set-up step). The step is recorded as such and is not counted against the case.

**C3b. Presence.**
- Specific: states observable properties or values.
- Generic: a general sentence that is not tied to the element or state under test.
- Reference-only: a link or pointer instead of a statement.
- Empty.

**C3c. Verifiability.**
- Objective: a tester or a tool reaches the same pass or fail decision from the stated criterion.
- By judgment: the decision depends on the observer because the acceptance criterion is not defined.
- Not verifiable: there is nothing to decide against.

Also record **consistency** of the expectation with the step: consistent, mismatched (it refers to something else), or contradictory (it conflicts with another statement of the case).

**Rule for "missing" and "weak":**

| Situation | Classification |
|---|---|
| Applicability F or P, presence Empty | **Finding: missing expected result** |
| Applicability F, presence Generic or Reference-only | **Finding: weak expected result** |
| Applicability F, presence Specific, but verifiability By judgment or Not verifiable | **Finding: weak expected result** (the stated criterion cannot decide pass or fail) |
| Applicability P, presence Generic, verifiability By judgment, but the scope observed (which screens, locales or states) is stated | **Property: limited verifiability.** Not a finding. |
| Applicability P, presence Generic, and the scope observed is also not stated | **Finding: weak expected result** |
| Applicability None | no classification of presence is made |
| Consistency mismatched or contradictory | **Finding: inconsistent expected result** (in addition to the above) |

### C4. Dependencies and environment

Record each dependency in these dimensions and mark each as **Stated** (E1), **Implied** (E3) or **Unstated** (needed but not in the case), or `UNKNOWN`:

1. other product features or configuration that must be active;
2. external services (mail, directory, network);
3. roles, permissions or tenancy;
4. data volume or a specific data state;
5. time or schedule windows;
6. product lifecycle state (fresh, starting, restarting, upgrading);
7. browser, platform or locale;
8. destructive or irreversible actions.

Also assign one **side-effect class**: None; Reversible side effect (the state can be restored by the case's own steps or a documented reset); Irreversible or shared-environment impact (data loss, lockout, restart, removal, effects on other users). The class is a **risk input**, not a finding about the case.

### C5. UI versus non-UI scope

| Value | Rule |
|---|---|
| UI-only | every step is performed, and every decisive statement observed, in the web UI |
| UI with non-UI support | the UI is used, but at least one step or observation needs another interface (mail, log, API, CLI, database, fault injection, system access) |
| Non-UI | the case is not performed in the web UI |
| `UNKNOWN(ambiguous)` | the interface cannot be determined |

### C6. Stability and repeatability

Judged from the text only; nothing is executed (D6).

| Value | Rule |
|---|---|
| Repeatable | re-running with the same declared state gives the same result, with no state consumed |
| State-consuming | running changes state, so a re-run needs a reset |
| Time-dependent | the result depends on a time window, a schedule or elapsed time |
| Data-dependent | the result depends on environment data that varies over time |
| Transient-state | the case relies on a short-lived or racing state |
| `UNKNOWN(not-tested)` | the text does not allow a decision |

More than one value may apply; list all that do, each with its evidence.

### C7. Support from the Phase 2 knowledge

Evaluate **each decisive statement** against the reviewed knowledge documents, then summarize.

| Value | Rule |
|---|---|
| Supported | a reviewed document states the same behavior of the same element (E2, cite id and section) |
| Partly supported | the document covers part of the statement |
| Contradicted | the document states something different |
| Not covered | the topic is not in the knowledge (a **knowledge gap, absent**) |
| Not verifiable with current knowledge | the document lists the topic as not verified (a **knowledge gap, unverified**) |
| Out of knowledge scope | the statement belongs to an edition, platform or area outside the three covered areas |

"Supported" means *consistent with the observed behavior recorded in the knowledge*. It does not mean that the case is right according to a specification. The case-level summary lists the counts per value (for example "3 supported, 2 not covered") and never reduces them to one grade.

### C8. Automation suitability and readiness

Two separate determinations; the rules are in part 9.

## 6. Findings, risks, knowledge gaps and open questions

Each item gets exactly one type. The test is **whose gap is it?**

| Type | Definition | Test | Id |
|---|---|---|---|
| **Finding (F)** | A deficiency of the test case as written, shown by its own text | It would still exist if the knowledge and the environment were perfect | `F-<key>-n` |
| **Risk (R)** | A potential harm or instability in executing or automating the case | It concerns what happens when the case is run | `R-<key>-n` |
| **Knowledge gap (K)** | Knowledge is missing or insufficient to judge a statement | It would disappear if the knowledge were extended | `K-<area>-n`, shared by cases that need the same knowledge |
| **Open question (Q)** | Information that nobody in the allowed sources can supply | It is an `UNKNOWN` that affects a value | `Q-<key>-n` |

Rules:

- A finding states the criterion, the rule that was violated, and the evidence tag.
- A risk states the trigger, the effect and the affected scope. It never states a code fix.
- A knowledge gap states the statement, the documents checked and whether the gap is **absent**, **unverified** or **insufficient detail**. It is never held against the case.
- A contradiction between a case and the knowledge is a **Q**: neither side is declared wrong, because settling it needs live verification, which is excluded.
- The same fact is recorded once, under the one type that fits. It may be referenced from the others.
- Neutral properties (limited verifiability, granularity, feature-status references) are recorded as properties, not as findings, unless a rule in part 5 turns them into one.

## 7. Localization and other non-functional cases

- A case is **not invalid because it is not functional.** Step 0 sets its intent type, and C3 then asks for the expectation that fits that intent (applicability P).
- A presentation or localization expectation is adequate when it states **what is observed** (screens, states, locales) and gives **an acceptance criterion**. Where the criterion is only a general sentence, verifiability is By judgment. That is recorded as the property "limited verifiability". It is a finding only when the scope observed is also missing (C3 table).
- The absence of a functional expectation is **not** a deficiency when the intent is Presentation or Non-functional. It is a deficiency only when the intent is Functional (or a Functional statement in a Mixed case).
- A case that is presentation-only is still evaluated on C1, C2, C4, C5, C6 and C7 in the usual way.
- Automation: limited verifiability affects suitability (part 9), not validity.

## 8. Unknown or insufficient knowledge

1. The knowledge is checked first. If a reviewed document states the behavior, the statement is Supported or Contradicted.
2. If the document lists the topic as not verified, the statement is **Not verifiable with current knowledge**, and a K item of the **unverified** kind is raised.
3. If no document covers the topic, the statement is **Not covered**, and a K item of the **absent** kind is raised.
4. No live check is made and no value is inferred to close a gap (D6). The gap is reported and left open.
5. A statement the knowledge cannot judge stays a decisive statement with an unresolved status. It never counts as a pass or as a failure.
6. K items are listed once per area and shared by the cases that need them, so that the coverage report (3.5) can count distinct gaps.

## 9. Automation suitability and readiness (no code)

**Suitability** asks whether the case could in principle be automated at the UI level. Decide in this order and take the first rule that applies:

| Value | Rule |
|---|---|
| Not UI-automation scope | C5 is Non-UI |
| Needs human judgment | a decisive statement has verifiability By judgment or Not verifiable |
| Suitable with non-UI support | C5 is UI with non-UI support |
| Suitable at the UI level | C5 is UI-only and every decisive statement is Objective |
| `UNKNOWN` | the information needed for the rules above is `UNKNOWN` |

**Readiness** asks whether the case could be automated now, from the case and the knowledge, with no new information. Decide in this order and take the first rule that applies:

| Value | Rule |
|---|---|
| Not applicable | suitability is Not UI-automation scope or Needs human judgment |
| Blocked: case quality | C1 is Not executable, or any decisive statement has a missing, inconsistent or contradictory expected result (a finding) |
| Blocked: knowledge | any decisive statement is Not covered, Not verifiable with current knowledge or Contradicted |
| Blocked: environment | the side-effect class is Irreversible or shared-environment impact, or a stated or implied dependency is not available or `UNKNOWN` |
| Ready after information | the only remaining gaps are undeclared needs in C2 or C4 that can be supplied without changing the case's intent |
| Ready | none of the above |

All blockers present are listed, with the first one as the primary. The primary blocker is the one that must be resolved first.

**Shortlist rule for 3.5:** an **automation candidate** is a case whose suitability is "Suitable at the UI level" or "Suitable with non-UI support" and whose readiness is "Ready" or "Ready after information". A **near candidate** has the same suitability and is blocked only by knowledge. A case that needs human judgment is never a candidate. A shortlist names cases and conditions only; no code, locators or scripts are written in Phase 3.

## 10. Analysis record for each case (used in 3.4)

```
Case: <key>  Area: <area>  Stratum: <stratum>
Intent (step 0): <type> [E-tag] <reason>
C1 Steps: <value> | granularity: <..> | feature-status references: <..> | evidence: <..>
C2 Pre-conditions: <value> | needs: <list, each E1/E3> | declared: <list>
C3 Expected results: per decisive statement: applicability | presence | verifiability | consistency
C4 Dependencies: <8 dimensions: Stated/Implied/Unstated/UNKNOWN> | side-effect class: <..>
C5 Scope: <value> | evidence
C6 Stability: <values> | evidence
C7 Knowledge support: per decisive statement: <value> [E2: doc id, section] | summary counts
C8 Suitability: <value> | Readiness: <value> | primary blocker: <..> | other blockers: <..>
Findings: F-<key>-n ...   Risks: R-<key>-n ...   Knowledge gaps: K-<area>-n ...   Open questions: Q-<key>-n ...
```

## 11. Consistency checks

Before a per-case record is accepted:

1. Every value has an evidence tag or is `UNKNOWN(...)` or `N/A(...)`.
2. No E3 value supports a "Supported" classification.
3. Every K item cites the documents checked.
4. Every blocker in readiness traces to a finding, a K item, a risk or an undeclared need.
5. Each fact is recorded once, under one type.
6. The intent type was set before C3 and C8 were evaluated.
7. The suitability and readiness tables were applied in the order given.
8. No numeric score, ranking or total was produced.
9. **Cross-case comparison (owner clarification, 2026-10-02).** Comparing cases is allowed only as a secondary consistency check. It is not a criterion and creates no score or ranking. If a comparison between analysed cases reveals duplicated or misleading content, inconsistent expectations for apparently the same behavior, inconsistent dependency or state declarations, or references between cases, the observation is recorded as the fitting finding, risk, knowledge gap or open question. A case's C1 to C8 value is never lowered merely because another case is different or similar.

## 12. Hypothetical examples (not taken from the 36 cases)

| Situation | Classification |
|---|---|
| A step's action field reads as a requirement ("the system shall do X") and contains no action. | C1: that step is a statement, so the case is Partly executable (or Not executable if all steps are statements). The wording is a **finding**. |
| An appearance check has one generic expected sentence, and the case names the screens and the locale it covers. | Intent Presentation. C3: applicability P, Generic, By judgment, scope stated, so the **property** "limited verifiability" and no finding. C8: suitability Needs human judgment, readiness Not applicable. |
| A behavior check has an empty expected result. | Intent Functional. C3: applicability F, Empty, so a **finding: missing expected result**. C8: readiness Blocked: case quality. |
| A behavior check says only "see the specification". | C3: applicability F, Reference-only, so a **finding: weak expected result**. |
| A case needs a message to arrive by email. | C4: external service Unstated. C5: UI with non-UI support. C7: Not covered, so a **K item (absent)**. Suitability: with non-UI support. Readiness: Blocked: knowledge, with Blocked: environment as a secondary blocker. |
| A case locks an account after repeated failures. | C4: side-effect class Irreversible or shared-environment impact. C6: State-consuming and Time-dependent. A **risk**. Readiness: Blocked: environment. |
| A case's expectation differs from what a knowledge document records for the same element. | C7: Contradicted. A **Q**: neither side is declared wrong. Readiness: Blocked: knowledge. |
| A step carries a note that the feature is "to be implemented". | C1 attribute: feature-status reference. C1: Partly executable if a step depends on it. C7: Not verifiable with current knowledge or Not covered, with a K item. |
| A case needs only a running product and a signed-in user and checks one visible text. | C2: N/A (no state needed). C3: applicability F or P, Specific, Objective. C5: UI-only. C7: Supported if a document records the text. Suitability: Suitable at the UI level. Readiness: Ready, so an **automation candidate**. |
