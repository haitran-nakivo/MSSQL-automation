# Phase 4 decision register

Status: **Phase 4 design CLOSED on 2026-10-02; S4-2 (migration) approved and the Phase 5 migration of the two NAKIVO specs carried out the same day.** The Derived and Proposed rules below remain unconfirmed and are not approved by the closure. Date: 2026-10-02 (rewritten in Step 5 so that every row has exactly one status; Xray decision finalized at closure). Part of `standards/README.md`. It lists every decision behind the standards and says **what authority each one has**. A rule is never silently promoted from one status to another.

## Status legend

| Status | Meaning |
|---|---|
| **Owner-approved** | Decided by the owner in an instruction, or in an earlier recorded owner decision, and recorded in `PROJECT_STATUS.md` |
| **Derived** | Follows directly from an owner-approved decision or from recorded evidence; the derivation is named. It awaits the owner's confirmation, because the owner did not state it. |
| **Proposed** | A rule chosen in this work to close a design gap. It applies to nothing until the owner approves it. |
| **Open** | Needs an explicit owner decision. No rule is chosen. |

**Acceptance of a step is not approval of its rules.** The owner accepted Step 3 "as completed" and Step 4 "as design work". That accepts the deliverable and its scope. It does not turn a Derived or Proposed rule into an owner-approved one, and no rule below has been upgraded because of it.

## A. Owner-approved Phase 4 decisions (2026-10-02)

Full text is in `PROJECT_STATUS.md`, section 5 (Phase 4).

| Id | Decision | Status |
|---|---|---|
| P4-0 | The Step 2 architecture design (layers `tests/`, `pages/`, `pages/components/`, `fixtures/`, `helpers/`, with `knowledge/` and `standards/`, their responsibilities and dependencies) is accepted together with P4-1 to P4-8 | Owner-approved |
| P4-1 | Phase 4 is an official phase; the Phase 1 to 3 prohibitions on automation design are historical | Owner-approved |
| P4-2 | `standards/` holds the automation rules; `knowledge/` holds product and UI facts | Owner-approved |
| P4-3 | Credentials through a small typed `.env` reader; never hard-coded or logged; errors never expose values | Owner-approved |
| P4-4 | UI login per test; no `storageState`, setup project, shared cookie file or authentication cache | Owner-approved |
| P4-5 | Verified product facts are not changed to ease automation; knowledge updates go through the normal process | Owner-approved |
| P4-6 | No guessed selectors; only strategies supported by evidence; unverified locators are follow-up items | Owner-approved |
| P4-7 | The Phase 3 shortlist stays empty; no new candidates; future implementation uses only already-approved existing coverage and creates no new functional coverage | Owner-approved |
| P4-8 | The Xray key is the stable identifier, kept in `tests/`; derived mappings under `workspace/`; no Jira write-back | Owner-approved |
| P4-9 | **Xray traceability, final Phase 4 design (owner, at closure):** the Xray test case key is stored as a Playwright test tag (`tag: ['@NJM-<number>']`); no separate Playwright annotation is required; it belongs in `tests/`; no Xray or Jira write-back is part of the automation architecture. This is the Step 3 standard (`naming-and-traceability.md` section 2) and replaces the earlier Step 3 row S3-3. | Owner-approved |
| P6-1 | **Amendment (owner, 2026-10-02, Phase 6): the base URL is environment-driven.** `NAKIVO_BASE_URL` is the base URL of the Director under test; `NAKIVO_USERNAME` and `NAKIVO_PASSWORD` remain the credentials; all three are read from the one repository-root `.env` by the one reader helper (S4-10 unchanged: one file, no search, no fallback). `NAKIVO_BASE_URL` is required and has no silent default. This amends the earlier recorded decision that the `baseURL` is fixed in `playwright.config.ts` (`PROJECT_STATUS.md` section 6). No multi-project support, no `.env.<profile>` files, the Login specs, `LoginPage`, `OverviewPage` and the assertions unchanged. | Owner-approved |

## B. Step 3 additions (rules in the standards that go beyond P4-0 to P4-9)

The former row S3-3 (Xray tag format) was approved by the owner at closure and is now P4-9.

| Id | Rule | Status | Recorded in |
|---|---|---|---|
| S3-1 | No sign-out in fixture teardown by default | **Derived** from P4-4 (the context is discarded per test) | `fixtures-and-session.md` §2.5 |
| S3-2 | An asserted expectation must be supported by existing knowledge or evidence | **Derived** from P4-5 and P4-6 | `assertions-and-waits.md` §1.5 |

## C. Step 4 decisions (each row has one status)

| Id | Rule | Status | Recorded in |
|---|---|---|---|
| S4-1a | The repository has exactly three spec files: two NAKIVO product specs and one infrastructure smoke spec | **Derived** from the repository inspection (Step 5) | `existing-specs.md` §1 |
| S4-1b | The existing coverage meant by P4-7 is the two NAKIVO product specs; the smoke spec is not product coverage | **Derived** from P4-7 | `existing-specs.md` §1 |
| S4-1c | The three specs are frozen (not edited, renamed, moved or migrated, and the knowledge citing them is not edited) until the owner instructs otherwise | **Derived** from the Step 4 instruction and the standing rule to do only what the latest instruction says (`PROJECT_STATUS.md` section 8) | `existing-specs.md` §1 |
| S4-2 | The two existing NAKIVO specs are migrated into the Phase 4 architecture, behavior-preserving, with no new coverage (owner instruction, 2026-10-02). When and how the migration is carried out is not decided here; it needs the owner's instruction to start implementation and the gating items in section D. | **Owner-approved** | `existing-specs.md` §2 |
| S4-3a | A migration does not change functional coverage (the owner's S4-2 instruction states "behavior-preserving, with no new coverage"; it also follows from P4-7) | **Owner-approved** | `existing-specs.md` §3 |
| S4-3b | A migration uses only the locators the knowledge records as verified | **Owner-approved** (confirmed by the owner in the instruction starting Phase 5, 2026-10-02)| `existing-specs.md` §3 |
| S4-3c | A migration keeps the file path and the test title (in place) | **Owner-approved** (owner instruction starting Phase 5, 2026-10-02) | `existing-specs.md` §3 |
| S4-3d | An assertion-equivalence record is written under `workspace/phase4/` before the original is replaced | **Owner-approved** (owner instruction starting Phase 5, 2026-10-02) | `existing-specs.md` §3 |
| S4-3e | Migrated tests are run only when the owner asks, and only them | **Owner-approved** (confirmed by the owner in the instruction starting Phase 5, 2026-10-02)| `existing-specs.md` §3 |
| S4-3f | Knowledge that cites the specs is updated only through the normal knowledge process (edit, review, changelog) | **Owner-approved** (P4-5) | `existing-specs.md` §4 |
| S4-3g | That update happens only after the migrated tests have passed, and `verified_on` dates change only after a real re-verification | **Owner-approved** (owner instruction starting Phase 5, 2026-10-02) | `existing-specs.md` §4 |
| S4-4a | An unresolved locator is not written into code: no guess, no placeholder, no disambiguation workaround | **Derived** from P4-6 | `locators.md` §4.1 |
| S4-4b | No inspection of the live Director without an explicit owner instruction that names the item | **Derived** from P4-6 and the rule to do only what the latest instruction says | `locators.md` §4.1 |
| S4-4c | The register `workspace/phase4/locator-follow-ups.md`, its fields and statuses | **Proposed** | `locators.md` §4.1 |
| S4-4d | The agent reports the blocked test and continues only inside approved existing coverage | **Proposed** | `locators.md` §4.1 |
| S4-4e | Approving an inspection is an owner instruction; approving a selector is the owner's acceptance of the reviewed knowledge update that records it | **Proposed** | `locators.md` §4.2 |
| S4-4f | The five items of evidence required before a selector is approved | **Proposed** | `locators.md` §4.3 |
| S4-4g | The items LF-1 to LF-6 are unresolved locators | **Derived** from what `ui.activities-elements`, `ui.overview`, `ui.overview-panels` and `ui.authentication-flows` record as observed or not verified | `locators.md` §5 |
| S4-5 | Numbered ids, `x-*` classes and other CSS classes are not approved as locators | **Derived** from P4-6 and the rule in `ui.overview` that classes are not used as locators | `locators.md` §2 |
| S4-6a | No localization infrastructure | **Owner-approved** (Step 4 instruction) | `architecture.md` §8 |
| S4-6b | No multilingual claim without evidence | **Owner-approved** (Step 4 instruction) | `architecture.md` §8 |
| S4-6c | English UI text is the initial assumption | **Derived** from `ui.locator-conventions` (Limits) | `architecture.md` §8 |
| S4-7a | No package is installed for enforcement | **Owner-approved** (`PROJECT_STATUS.md` section 8: do not install anything unless asked; Step 4 instruction) | `architecture.md` §7 |
| S4-7b | No lint or boundary tool is required before the first implementation; a manual nine-item checklist applies | **Proposed** | `architecture.md` §7 |
| S4-7c | The triggers after which automated enforcement may become necessary | **Proposed** | `architecture.md` §7 |
| S4-8a | A fixture may only create page objects, supply configuration and credentials through the helper, and sign in through the UI | **Owner-approved** (confirmed by the owner in the instruction starting Phase 5, 2026-10-02)| `fixtures-and-session.md` §4 |
| S4-8b | Any change of product state by a fixture, helper or test needs a separate owner decision | **Owner-approved** (confirmed by the owner in the instruction starting Phase 5, 2026-10-02)| `fixtures-and-session.md` §4 |
| S4-8c | The list of examples of state-changing actions, and the format of the decision request | **Proposed** | `fixtures-and-session.md` §4 |
| S4-8d | API-level checks are out of the initial architecture | **Proposed** | `fixtures-and-session.md` §4 |
| S4-9 | `smoke.spec.ts` is an infrastructure check, stays at `tests/smoke.spec.ts`, is outside the layer rules and is not a template | **Proposed** | `existing-specs.md` §5 |
| S4-10 | The `.env` reader reads one file, `<repository root>/.env`, found from its own location, with no search and no fallback | **Owner-approved** (owner instruction starting Phase 5, 2026-10-02) | `fixtures-and-session.md` §3.7 |

**Count (44 rows): Owner-approved 25 (P4-0 to P4-9, P6-1, S4-2, S4-3a to S4-3g, S4-6a, S4-6b, S4-7a, S4-8a, S4-8b, S4-10); Derived 10; Proposed 9; Open 0.**

## D. Gating for implementation

**Required before any implementation can start**
1. An explicit owner instruction to start implementation (P4-0 to P4-8 say implementation needs a separate instruction).
2. **S4-2 (decided).** P4-7 limits implementation to already-approved existing coverage, and that coverage is the two NAKIVO specs (S4-1b). The owner approved their migration on 2026-10-02, behavior-preserving and with no new coverage. This item is satisfied.
3. Because S4-2 is "migrate": the owner's approval of the Proposed S4-3c, S4-3d and S4-3g, and confirmation of the Derived S4-3b and S4-3e (S4-3a is now Owner-approved).
4. Whatever the first implementation uses of the helper and fixture rules: approval of S4-10 (`.env` location), confirmation of S4-8a and S4-8b.

**Intentionally deferred until implementation needs them**
- S4-4c to S4-4f and S4-4g (locator register, evidence and approval): the two NAKIVO specs use only verified locators, so no unresolved locator blocks them. The policy applies when coverage grows, which needs its own owner decision.
- S4-5 (confirmation), S4-6c (the lab instance is English), S4-7b and S4-7c (manual review until a trigger), S4-8c and S4-8d (nothing state-changing or API-level is planned), S4-9 (no action needed), S3-1 (the migrated specs do not need a signed-in fixture, because the only authenticated spec tests signing in).

**Needing the owner's explicit approval in any case:** every Derived row (confirmation) and every Proposed row (approval). No row is Open.

## E. Phase 4 design closure (2026-10-02)

The Phase 4 design is **closed**. The closure approves P4-9 and nothing else.

- **Open (0):** S4-2 was Open at closure and was approved afterwards (see the update below).
- **Proposed (9, after the Phase 5 approvals):** S4-4c, S4-4d, S4-4e, S4-4f, S4-7b, S4-7c, S4-8c, S4-8d, S4-9.
- **Derived (10, after the Phase 5 confirmations), awaiting confirmation:** S3-1, S3-2, S4-1a, S4-1b, S4-1c, S4-4a, S4-4b, S4-4g, S4-5, S4-6c.
- All of them may stay as they are and be deferred until implementation needs them (section D).
- **Implementation has not started.** It needs the owner's explicit instruction and the decision on S4-2 (section D).

**Update, 2026-10-02 (after closure): S4-2 approved by the owner.** The two existing NAKIVO specs will be migrated into the Phase 4 architecture, behavior-preserving, with no new coverage. S4-3a became Owner-approved because the instruction states it. Nothing else was approved: S4-3b, S4-3e and the other Derived rules still await confirmation, and S4-3c, S4-3d, S4-3g and S4-10 still await approval. **No migration has been carried out and implementation has not started**; the specs stay frozen (S4-1c) until the owner instructs the start.

**Update, 2026-10-02 (Phase 5 start and result).** The owner approved S4-3c, S4-3d, S4-3g and S4-10 (Proposed) and confirmed S4-3b, S4-3e, S4-8a and S4-8b (Derived), and instructed the migration of exactly the two NAKIVO specs. Those eight rows are now Owner-approved. The gating items of section D are satisfied for this migration. The migration was carried out and its two tests passed (`workspace/phase4/assertion-equivalence.md`). S4-1c (frozen) is lifted for the two NAKIVO specs only; `smoke.spec.ts` stays frozen. Every other Derived or Proposed row is unchanged.

**Update, 2026-10-02 (Phase 6 amendment P6-1).** The owner approved an environment-driven base URL (`NAKIVO_BASE_URL`) and the amendment of the "fixed baseURL in the config" decision. It is recorded as P6-1 (Owner-approved) and implemented in `helpers/credentials.ts` and `fixtures/index.ts`. No other row changed.
