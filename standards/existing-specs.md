# Existing specs: policy

Status: **DRAFT for owner review.** Date: 2026-10-02. Part of `standards/README.md`. Decision statuses are in `decisions.md` (S4-1, S4-2, S4-3, S4-9). **Nothing in this document migrates, edits or tests any spec or knowledge document.**

## 1. What the three specs are (S4-1a, S4-1b, S4-1c, Derived)

A repository search on 2026-10-02 found exactly **three** spec files, all in `tests/`, and no other `*.spec.ts` or `*.test.ts` file outside `node_modules`:

- **NAKIVO product specs (two):** `tests/nakivo-login.spec.ts` and `tests/nakivo-login-auth.spec.ts`. So the phrase "the two NAKIVO specs" used below is correct.
- **Infrastructure spec (one):** `tests/smoke.spec.ts`.
- **Total existing specs: three** (two product, one infrastructure).

| Spec | What it checks | Knowledge that cites it |
|---|---|---|
| `tests/smoke.spec.ts` | opens `example.com` and checks its title; it verifies the toolchain, not the product | none |
| `tests/nakivo-login.spec.ts` | the login page shows the title, Username, Password and LOG IN; it does not sign in | `ui.login`, `ui.auth-session`, `ui.locator-conventions` (source and "Verified by test" or "Used in") |
| `tests/nakivo-login-auth.spec.ts` | signs in with `.env` credentials, then the URL is not `/c/login`, the login form is hidden and `getByTitle('Logout')` is visible | `ui.auth-session`, `ui.locator-conventions`, `ui.overview` |

- The two NAKIVO specs are the **existing product coverage**: passing tests created at the owner's request in Phase 0 and recorded in `PROJECT_STATUS.md` section 3. Under P4-7 a future implementation may use only already-approved existing coverage; these two specs are treated as that coverage (Derived), and nothing else is. `smoke.spec.ts` is an infrastructure check, not product coverage (section 5).
- They are **evidence artifacts**: the two NAKIVO specs are cited as T1 corroboration in the knowledge.
- They are **not automation candidates** and do not reinterpret the Phase 3 shortlist, which stays empty. Phase 3 analysed Xray cases; these specs are not Xray cases and carry no Xray tag.
- **Until the owner instructs otherwise they are frozen** (S4-1c). On 2026-10-02 the owner instructed the migration of the two NAKIVO specs, so the freeze is lifted for those two only; `smoke.spec.ts` stays frozen: not edited, renamed, moved or migrated, and the knowledge documents that cite them are not edited.
- They are not governed retroactively by the naming standard. The area folders in `naming-and-traceability.md` apply to new tests.

## 2. Migration (S4-2, Owner-approved 2026-10-02)

- **The owner approved the migration of the two NAKIVO specs into the Phase 4 architecture, behavior-preserving, with no new coverage** (instruction of 2026-10-02).
- **Carried out on 2026-10-02 (Phase 5)** after the owner approved S4-3c, S4-3d, S4-3g and S4-10 and confirmed S4-3b, S4-3e, S4-8a and S4-8b. The record is `workspace/phase4/assertion-equivalence.md`. Both migrated tests passed.
- `smoke.spec.ts` is not part of this decision.
- Migration is never required for a new test, and never changes the rule that a new test must realize already-approved existing coverage.

## 3. Conditions of the migration (S4-3; statuses per point and in `decisions.md`)

1. **No change of functional coverage (S4-3a, Owner-approved; also Derived from P4-7).** The migrated test asserts exactly what the original asserted, no more and no fewer; no new assertion, no new test, no new behavior.
2. **Same locators.** It uses only the locators the knowledge records as verified for these specs, now held in a page object (`locators.md`).
3. **In place.** The migrated file keeps its path and its test title, so the knowledge citations stay accurate. These two specs stay at the top of `tests/`.
4. **Equivalence record.** Before the original is replaced, a table under `workspace/phase4/` lists each original assertion and the line that preserves it. The owner reviews it with the migrated file.
5. **Run only on instruction.** The migrated tests are run, and only them, when the owner asks. A migrated test counts as evidence only after it has passed.
6. **The login test stays independent.** The login-form test and the sign-in test do not use the signed-in fixture (`fixtures-and-session.md`).

## 4. Knowledge documents that cite the specs (S4-3f Owner-approved; S4-3g Owner-approved 2026-10-02)

- **Now:** unchanged. The specs are unchanged, so the citations are accurate.
- **After an approved migration:** the verified product facts stay as they are. If a citation becomes inaccurate (a path or a "used in" statement), it is updated through the normal knowledge process (edit, review, changelog entry), and only after the migrated tests have passed. `verified_on` dates are not changed unless a re-verification is actually performed.
- A knowledge document is never edited to make a migration easier.

## 5. `smoke.spec.ts` (S4-9, Proposed)

- **Purpose:** an infrastructure check that Playwright, the browser and the TypeScript setup work. It tests no NAKIVO behavior and contributes no product coverage or evidence.
- **Placement:** stays at `tests/smoke.spec.ts`. It is not moved, renamed or modified.
- **Outside the layer rules:** it needs no page object, fixture or helper and carries no Xray tag. It is not a template for product tests.
- **Fact for the owner, no rule:** it opens an external site (`https://example.com`), so its result depends on access to that site. Whether to keep or retire it is left to the owner.

## 6. Result of the migration (2026-10-02)

- Migrated in place (same paths, same titles): `tests/nakivo-login.spec.ts` and `tests/nakivo-login-auth.spec.ts`. New files: `helpers/credentials.ts`, `pages/login.page.ts`, `pages/overview.page.ts`, `fixtures/index.ts`.
- Both tests passed when run alone. No new assertion, locator or coverage was added.
- **Knowledge citations:** every statement in `ui.login`, `ui.auth-session`, `ui.locator-conventions` and `ui.overview` that cites the specs was re-read and is still accurate (same files, same assertions, the same verified locators now used through page objects). No knowledge document was changed and no changelog entry was needed. `verified_on` was not changed: the run re-confirmed only the asserted subset of the facts, and those documents record facts beyond it, so a date change would overstate a re-verification.
