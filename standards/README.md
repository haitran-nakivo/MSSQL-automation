# Automation standards

Status: **Phase 4 design CLOSED on 2026-10-02.** Rules marked Derived or Proposed in `decisions.md` are not approved by the closure and may be deferred until implementation needs them. Created 2026-10-02 (Phase 4, Step 3). Normative rules for the automation architecture and engineering of this project (Playwright Test + TypeScript). Source: the owner decisions of Phase 4 recorded in `PROJECT_STATUS.md` section 5, and the Step 2 design accepted by the owner on 2026-10-02.

These standards are **design only**. No page object, fixture, component, helper or test exists because of them, and no existing file is changed by them. Implementation starts only on a later owner instruction.

## What is where

| Document | Covers |
|---|---|
| `architecture.md` | Layers, dependencies, allowed and forbidden contents, component rule, helper admission rule |
| `locators.md` | Locator preference, prohibitions, evidence requirement, unresolved locators |
| `assertions-and-waits.md` | Where assertions live, what page objects expose, waits |
| `fixtures-and-session.md` | Fixture scope, UI login per test, credentials |
| `naming-and-traceability.md` | File, class and test naming; Xray traceability |
| `existing-specs.md` | Policy for the three existing specs and `smoke.spec.ts` (Step 4) |
| `flows-layer.md` | The `flows/` layer: reusable page-action sequences with no assertions |
| `tool-layer.md` | The `tool/` layer (Xray/Jira integration, registry, runner, local interface): its boundary and the one exception to the no-Jira rule |
| `decisions.md` | Register of every Phase 4 decision with its authority: owner-approved, derived, proposed or open |

## Rules about the standards themselves

1. **Standards hold rules, knowledge holds facts.** Product and UI facts, and their provenance, stay in `knowledge/`. Nothing here is product knowledge, and no automation rule is added to `knowledge/`. A standard may point to a knowledge document by its `id` and never copies its facts.
2. **Precedence.** An owner decision recorded in `PROJECT_STATUS.md` outranks a standard. A standard outranks a habit or an example. If they conflict, the conflict is reported and the owner decides.
3. **Nothing is invented silently.** A rule that is not an owner decision or part of the accepted Step 2 and Step 3 design is marked "Proposed" or "Derived" (derived from a named owner decision or from recorded evidence), and `decisions.md` gives the status of each Step 4 decision. A Proposed rule applies to nothing until the owner approves it; a Derived rule awaits the owner's confirmation. A rule is never promoted from one status to another without a recorded owner instruction.
4. **Changing a standard** needs an owner instruction and is recorded in `PROJECT_STATUS.md`. The knowledge governance and schema (`knowledge/_meta/`) are not extended for standards.
5. **Scope.** The standards apply to the approved scope: Authentication, Activities and Overview. They add no scope, select no test case and create no automation candidate (the Phase 3 shortlist is empty).
6. **Code does not read documents.** No code reads `knowledge/`, `standards/` or `workspace/` at run time.

## Current state

The Phase 4 design was reviewed for consistency in Step 5 (2026-10-02); the decision register in `decisions.md` classifies every decision as Owner-approved, Derived, Proposed or Open. The three existing specs (`tests/smoke.spec.ts`, `tests/nakivo-login.spec.ts`, `tests/nakivo-login-auth.spec.ts`) are unchanged and are not governed retroactively; `existing-specs.md` records what they are, that they are frozen, and the conditions of a possible later migration. The two NAKIVO specs were migrated into this architecture on 2026-10-02 (Phase 5, `decisions.md` S4-2; record in `workspace/phase4/assertion-equivalence.md`); `smoke.spec.ts` was not touched. The code layers that exist are `helpers/credentials.ts`, `pages/login.page.ts`, `pages/overview.page.ts` and `fixtures/index.ts`.
