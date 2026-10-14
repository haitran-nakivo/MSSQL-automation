# Phase 3: Authentication analysis (milestone 3.4, Authentication only)

Status: **APPROVED by the owner on 2026-10-02**, kept as recorded. Owner decision on section 9, item 1: the Phase 3.5 shortlist is **case-level**; statement-level observations stay informational. Items 2 and 3 stay recorded as observations; the rubric is unchanged. Date: 2026-10-02. Derived working material in `workspace/`, not part of the knowledge layer. Applies `analysis-rubric.md` (C1 to C8 unchanged, approved) to the 12 approved Authentication cases of `selected-cases.md`. No numeric scores, no ranking, no total.

Sources used: the case text (E1, from the read-only Jira fetch of 2026-10-02: title, description, step action, data, expected result; no comments, no attachments, no enriched archives, no linked issues), and the reviewed knowledge documents `ui.authentication-flows`, `ui.login` and `ui.auth-session` (E2, cited by id and section). No UI was explored. No Jira case was modified. No locators, code or scripts were written.

## 1. Conventions applied (how the rubric was read)

These are readings of the approved rubric, recorded so the reviewer can check them. None changes a criterion.

1. **Statement ids.** `S<n>` is a decisive statement of a case (not the step number). `L<n>` is the sentence "the product UI shall be displayed in the installer's selected language" in step n. Every case except NJM-104803 carries it in every step; NJM-104803 words it differently and adds two statements.
2. **Statement L.** Intent Presentation. C3: applicability P, presence Generic, verifiability By judgment. The screen or element is named by the title or step and the locale is "the installer's selected language" (the set of languages is not listed), so under the 3.3 table this is the **property "limited verifiability"**, not a finding. C7: **Not verifiable with current knowledge**, because `ui.authentication-flows` (Not verified) lists "other languages", and the "installer's selected language" is not in the knowledge (K-authentication-1).
3. **Bare element labels.** A step such as `Done button:` or `Profile` names an element but states no operation. It is **not an action** under C1 (an action says what to do to which element). A step that starts with "Check" is an action.
4. **Binary acceptance rules** ("required", "disabled in case X", "1-25 characters", "accepts 6 or 16 characters") count as Objective when the pass/fail outcome is observable (the control is disabled or the flow proceeds or does not). If the case does not say *how a rejection looks*, that is recorded as an open question, not as a deficiency of the statement.
5. **Statement-level view for Mixed cases.** Rubric part 4 says C3 and C8 are evaluated per statement for Mixed cases. The shortlist rule (part 9) speaks of a *case*. This milestone therefore reports C8 twice: the **case level** (first rule that applies over all decisive statements) and a **statement-level view** (each statement with its own suitability and readiness, using the statement's own dependencies). The case level follows the approved rules literally. How the shortlist should use the statement-level view is **not decided here** (owner decision, section 9).
6. **Side-effect class** is assigned from what the steps and expected results as written require (E1, E3 where marked). A need that only the undeclared set-up has is recorded under C4 dimension 8, not in the class.
7. **Cross-case comparison** (owner clarification, 2026-10-02) is a secondary consistency check only. It is not a criterion, creates no score or ranking and lowered no C1 to C8 value. Observations are in section 7 and are recorded as F, R, K or Q only where they reveal duplicated or misleading content, inconsistent expectations or state declarations, or references between cases.
8. **Wording of controls.** Differences of letter case between a case and `ui.login` (for example "Log In" and "LOG IN", "Done" and "DONE") are not treated as differences (E3 assumption). Differences of words are (see Q-98473-1, Q-98479-1).
9. **Abbreviations in the tables.** C3: P presentation, F functional; Spec specific, Gen generic, Ref reference-only; Obj objective, Jdg by judgment, NotV not verifiable. C7: Sup supported, Part partly supported, NC not covered, NV not verifiable with current knowledge. C4 dimensions: D1 other features or configuration, D2 external services, D3 roles, permissions, tenancy, D4 data volume or state, D5 time or schedule, D6 product lifecycle state, D7 browser, platform, locale, D8 destructive or irreversible actions.

## 2. Knowledge gaps (shared by the cases, listed once)

Documents checked for every item: `ui.authentication-flows` (including Not verified), `ui.login` (including Not verified), `ui.auth-session`. Kind is absent, unverified, or insufficient detail.

| Id | Gap | Kind | Cases |
|---|---|---|---|
| K-authentication-1 | Localization: the "installer's selected language" is not in the knowledge, and `ui.authentication-flows` lists other languages as not verified | absent; unverified | all 12 |
| K-authentication-2 | Two-factor authentication: verification-code screen, verification options, configure-2FA screen, backup codes (listed as not verified) | unverified | 98495, 98496, 98473 |
| K-authentication-3 | Wrong credentials: warning text, field highlighting, attempt counting, the C2 screen and any lockout (listed as not verified: "error messages, attempt limits and account lockout") | unverified | 98477, 98494, 98473 |
| K-authentication-4 | Password reset beyond the first view: what DONE does (listed as not verified); the email-reset screen E1, local-reset F1 and contact-administrator G1 screens; delivery of the security string | unverified; absent | 98479, 98483, 98473 |
| K-authentication-5 | Tenancy and roles: multi-tenant or service-provider mode, disabled tenant, remote tenant, Tenants dashboard, Master Admin and Admin roles (role differences are listed as not verified) | absent; unverified | 98491, 98494, 98483, 98473, 98495 |
| K-authentication-6 | First-run screens: Create User Account (product registration) and Product Configuration Wizard | absent | 98472, 98473, 98495 |
| K-authentication-7 | Browser compatibility message and the list of supported or unsupported browsers | absent | 98512 |
| K-authentication-8 | The "system is starting" screen and its automatic redirect | absent | 98516 |
| K-authentication-9 | What the Profile entry of the Logout menu opens or shows (listed as not verified) | unverified | 104803 |
| K-authentication-10 | Common requirements pointed to by the cases (username and password field rules, "Common UI - Password Input", show/hide toggle and its icons, acceptance of "@", default content of the fields) | absent | 98472, 98473, 98479 |
| K-authentication-11 | The product screen footer: `ui.login` lists a Privacy policy link, a NAKIVO link and a support mail link but does not identify them as a footer or describe their language | insufficient detail | 98472, 98473, 98477, 98479, 98483, 98491, 98494, 98495, 98496, 98512, 98516 |
| K-authentication-12 | Emails sent by the product (verification-code email: sender, recipients, subject, body, default from name) | absent | 98496 (also relevant to 98483, 98495) |

## 3. Per-case analysis

Selection order of `selected-cases.md` is kept.

### 3.1 NJM-98495: Two-factor authentication - A-2FA-2: Enter verification code

Case: NJM-98495  Area: Authentication  Stratum: Two-factor authentication  (2 steps)

**Intent (step 0): Mixed** [E1]. Step 1 holds presentation statements (two infotext variants), and functional statements (accepted input, single-use backup code, Proceed outcome, link outcome). Step 2 is a presentation check. The case is labelled Localization (E1); that is recorded as a property, not judged.

**C1: Executable.** Both steps are "Check ..." actions; the target (screen A-2FA-2) is identified by the title. Granularity: bundled (step 1 holds six separate checks). Actions that the expected result needs but the step does not state: entering a code, clicking Proceed, clicking the link (E3). Feature-status references: none.

**C2: Absent.** Needs [E1/E3]: a user with 2FA enabled and configured (E3); both a Google Authenticator default and an email default, i.e. two states (E1); access to the code source, an authenticator app or a mailbox (E1); a valid 6-digit code and a 16-digit backup code (E1); a selected email address (E1). Declared: none.

**C3 and C7 per decisive statement**

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | Infotext when Google Authenticator is the default method: exact string | P, Spec, Obj, consistent | NV [E2: ui.authentication-flows, Not verified: two-factor authentication] K-2 |
| S2 | Infotext when Email is the default or the code was requested on A-2FA-3: exact string with the selected address | P, Spec, Obj, consistent | NV, K-2 |
| S3 | Text box: required, 6 or 16 characters, accepts a 6-digit code or a 16-digit backup code | F, Spec, Obj (rule 4), consistent | NV, K-2 |
| S4 | One backup code can be used only once | F, Spec, Obj (rule 4), consistent | NV, K-2 |
| S5 | Proceed shows the Overview, the Tenants dashboard or the Configuration Wizard "accordingly" | F, Spec, **Jdg** (the condition behind "accordingly" is not stated), consistent | NV, K-2 |
| S6 | More verification options opens A-2FA-3 | F, Spec, Obj, consistent (the identifier resolves to NJM-98496, section 7) | NV, K-2 |
| L1, L2 | Language sentence, step 1 and step 2 | rule 2 | NV, K-1, K-11 (L2) |

C7 summary: 0 supported, 0 partly, 8 not verifiable (6 two-factor, 2 language).

**C4:** D1 2FA, email method, backup codes [Stated]; D2 authenticator app, mail [Stated]; D3 tenant or single-tenant destination [Stated, "Overview or Tenants dashboard"]; D4 user's codes [Implied]; D5 time-based or expiring code [Implied, E3: codes are "generated"; validity not stated]; D6 none; D7 locale [Stated]; D8 backup-code consumption [Stated]. **Side-effect class: UNKNOWN(absent)**: S4 consumes a backup code, and whether it can be restored is not in the sources.
**C5: UI with non-UI support** [E1]: the 6-digit code comes from an authenticator app or a mailbox.
**C6: State-consuming** [E1, single-use backup code]; **Time-dependent** [E3].
**C8 case level:** Suitability **Needs human judgment** (L1, L2 and S5 are By judgment). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S1, S2, S4, S6; Suitable with non-UI support: S3; Needs human judgment: S5, L1, L2. All five suitable statements: Blocked: knowledge (primary), Blocked: environment (secondary: 2FA users, code source, side-effect class).

Findings: **F-98495-1** (C3, weak expected result): S5 names three possible outcomes joined by "accordingly" and gives no rule that maps a user or state to an outcome, so the stated criterion cannot decide pass or fail [E1].
Risks: **R-98495-1** trigger: re-running S4; effect: the backup codes of the test user are used up and a later run cannot repeat it; scope: that user. [E1, E3] **R-98495-2** trigger: using an account shared with other tests as the 2FA user; effect: that account's sign-in flow changes for every other test; scope: shared lab account. [E3]
Knowledge gaps: K-1, K-2, K-5, K-6, K-11.
Open questions: **Q-98495-1** the first infotext string ends with a full stop inside the quotes and the second does not; whether the stop is part of the expected string cannot be told from the sources. **Q-98495-2** how a rejected code, and a second use of a backup code, is shown (message or field state) is not stated. **Q-98495-3** which condition selects the Overview, the Tenants dashboard or the Configuration Wizard.

### 3.2 NJM-98483: Password reset - E1: Email password reset

Case: NJM-98483  Area: Authentication  Stratum: Password reset  (5 steps)

**Intent: Mixed** [E1]: infotext and placeholder (presentation); length rule, link behavior by role and Done behavior (functional).

**C1: Partly executable.** Steps 1 and 5 are "Check" actions. Step 2 (`Enter the security string from email field:`) can be read as an instruction to type a string or as the field's label; no value is given, so it is `UNKNOWN(ambiguous)` and not an action. Steps 3 and 4 are bare labels (rule 3). Granularity: one element per step. Feature-status references: none.

**C2: Absent.** Needs: a way to reach screen E1 (E3; the case says nothing); a user with an email address on file and a mailbox (E3); an Admin or Master Admin user and a user who is neither, for the two link branches (E1); single-tenant and multi-tenant products, hinted by "(MT)" and "(ST)" (E1). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | Infotext: exact string about the secure string sent to the email address | P, Spec, Obj | NC, K-4 |
| S2 | Input accepts 1-25 Unicode characters; placeholder "Enter security string from email" | F+P, Spec, Obj (rule 4) | NC, K-4 |
| S3 | "Did not receive a message?" opens F1 for Master Admin (MT) or Admin (ST) and G1 for other users | F, Spec, verifiability `UNKNOWN(ambiguous)`: "the current user" is not defined on a screen reached before signing in | NC, K-4, K-5 |
| S4a | Done is disabled when the field is invalid | F, Spec, Obj (E3: "invalid" read as outside the S2 rule) | NC, K-4 |
| S4b | Clicking Done "shall evaluate the entered string" | F, **Gen** (no observable outcome), NotV | NC, K-4 |
| L1 to L5 | Language sentence in each of the five steps | rule 2 | NV, K-1, K-11 (L5) |

C7 summary: 0 supported, 0 partly, 5 not covered, 5 not verifiable (language).

**C4:** D1 email password reset [Implied]; D2 mail [Implied]; D3 Master Admin, Admin and other roles, MT and ST [Stated]; D4 an issued security string [Implied]; D5 lifetime of the string [`UNKNOWN(absent)`]; D6 none; D7 locale [Stated]; D8 reaching the screen needs a reset request on an account, effect not stated [`UNKNOWN(absent)`]. **Side-effect class: UNKNOWN(absent)** (S4b clicks Done with a value and the infotext speaks of a "temporary password").
**C5: UI-only** [E3]: no stated observation needs another interface, because no step reads the mail. Caveat: how E1 is reached is not stated.
**C6: State-consuming** [E3, a reset request issues a string]; time dependence `UNKNOWN(not-tested)`.
**C8 case level:** **Needs human judgment** (L1 to L5, S4b). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S1, S2, S4a (Blocked: knowledge primary; environment secondary: reset effect unknown); Suitability `UNKNOWN`: S3; Needs human judgment: S4b, L1 to L5.

Findings: **F-98483-1** (C1): steps 3 and 4 are bare labels and step 2 is ambiguous between an instruction and a label, so the case states few actions [E1]. **F-98483-2** (C3, weak expected result): S4b states an action ("evaluate") but no observable outcome [E1].
Risks: **R-98483-1** trigger: requesting a reset on an account to reach E1 and clicking Done; effect: not stated, the infotext implies a temporary password; scope: that account. [E1, E3]
Knowledge gaps: K-1, K-4, K-5, K-11, K-12.
Open questions: **Q-98483-1** who "the current user" is on a pre-sign-in screen (the account typed on D1, or someone else). **Q-98483-2** what is shown when more than 25 characters are entered, and whether "invalid" means only a length violation. **Q-98483-3** the lifetime of the string and the effect of a reset request on the existing password.

### 3.3 NJM-98472: Default login screen - A1: Create User Account - PRG-2: Create User Account screen

Case: NJM-98472  Area: Authentication  Stratum: Default login screen  (9 steps)

**Intent: Mixed** [E1]: per-field presentation checks, plus functional statements (password show/hide behavior, Remember me default, what Create account does).

**C1: Partly executable.** All nine steps are "Check ..." actions, but steps 1, 2, 3 and 5 carry "(to be implemented with NJM-11650)" and the description says "Some fields are not implemented so kindly abort those steps": they depend on something the case itself marks as not yet available. Granularity: one element per step, but steps 6 and 8 bundle many checks. Implied actions (E3): typing a password, clicking the toggle, clicking Create account. Feature-status references: **unimplemented** (steps 1, 2, 3, 5), **to be disabled** (step 8, "Verify the email field (to be disabled by NJM-14438)").

**C2: Absent.** Needs: a product in the first-run state with no default user (E3; step 8 creates "the default user account"); a way to reach the screen (E3); valid username and password values per rules the case only points to (E1); the installer language choice (E1). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| L1 to L9 | Language sentence in the nine steps (steps 1, 2, 3, 5 carry nothing else) | rule 2 | NV, K-1, K-11 (L9) |
| S1 | Username: required field | F, Spec, Obj (rule 4) | NC, K-6 |
| S2 | Username: "see Common for the Product" | F, **Ref**: weak | NC, K-10 |
| S3, S4 | Password: "see Common for the Product", "see Common UI - Password Input" | F, **Ref** (two pointers): weak | NC, K-10 |
| S5 | Typed characters are replaced by dots | P, Spec, Obj | NC, K-10 |
| S6 | Password can be shown and hidden with the eye toggle | F, Spec, Obj | NC, K-10 |
| S7 | The toggle is not shown when it is the existing password loaded in the field | F, Spec; **mismatched** (E3: a Create Account screen has no existing password to load) | NC, K-6, K-10 |
| S8 | The first change in the password field clears the existing password fields | F, Spec; **mismatched** (same reason) | NC, K-6, K-10 |
| S9 | The toggle is shown when the user types a new password | F, Spec, Obj | NC, K-10 |
| S10, S11 | Toggle icons are CI017 (hidden) and CI016 (shown) | P, **Ref** (identifiers of an icon catalogue), Jdg | NC, K-10 |
| S12 | Remember me is deselected by default | F, Spec, Obj | NC, K-6 (the element of the same name on the login screen is a different screen, so `ui.login` does not support it) |
| S13 | Create account verifies the email field (to be disabled) | F, **Gen** (no outcome stated), NotV | NC, K-6 |
| S14 | Create account creates the default user account | F, Spec, Obj (E3: observable through a later sign-in) | NC, K-6 |
| S15 | Create account logs the user in | F, Spec, Obj (destination not stated) | NC, K-6 |

Decisive statements: 9 language + 15 others = 24. C7 summary: 0 supported, 0 partly, 15 not covered, 9 not verifiable.

**C4:** D1 NJM-11650 and NJM-14438 [Stated]; D2 email verification, if any [`UNKNOWN(absent)`]; D3 none; D4 field values [Unstated]; D5 none; D6 first-run, fresh product [Implied]; D7 installer language [Stated]; D8 creating the default account [Stated]. **Side-effect class: Irreversible or shared-environment impact** [E1, S14 and S15; the case has no reset step].
**C5: UI with non-UI support** [E1 + E3]: the installer language and a fresh deployment.
**C6: State-consuming** [E1]: after the account exists the screen cannot be reached again.
**C8 case level:** **Needs human judgment**. Readiness **Not applicable**.
Statement-level view: Suitable with non-UI support: S1, S5, S6, S9, S12, S14, S15 (Blocked: knowledge primary; environment secondary); Needs human judgment: the 9 language statements, S2, S3, S4, S7, S8, S10, S11, S13.

Findings: **F-98472-1** (C1): four steps depend on features the case marks as not implemented and the description tells the tester to abort them; which fields are implemented now is not recorded [E1]. **F-98472-2** (C3, weak expected result): S2, S3 and S4 are pointers to other documents, not statements [E1]. **F-98472-3** (C3, inconsistent expected result): S7 and S8 describe an existing password loaded in the field, which does not fit a screen that creates the first account (misleading content, E3 reasoning from E1).
Risks: **R-98472-1** trigger: executing S14 and S15; effect: the default account is created and the user is logged in, with no way back inside the case; scope: the product instance. [E1] **R-98472-2** trigger: running the case on an instance that is already configured; effect: the screen cannot be reached (the lab instance in `ui.login` shows the normal login screen), so the case cannot run without a fresh deployment. [E2 + E3]
Knowledge gaps: K-1, K-6, K-10, K-11.
Open questions: **Q-98472-1** the case says the Business email field is "to be implemented" (step 5) and also that the Create account button verifies the email field "to be disabled" (step 8); whether these describe one timeline or conflict is `UNKNOWN(ambiguous)`. **Q-98472-2** the title says "Create User Account screen" and step 9 says "Product Registration screen footer"; whether they are the same screen is not stated. **Q-98472-3** whether NJM-11650 and NJM-14438 are implemented today (the linked issues were not read, by scope).

### 3.4 NJM-98512: Browser compatibility messages - I1-A: In case the web browser is not supported (credentials configured)

Case: NJM-98512  Area: Authentication  Stratum: Browser compatibility messages  (2 steps)

**Intent: Presentation** [E1]: the case checks a displayed message and the rest of the screen. The unsupported browser is a condition, not a checked behavior.

**C1: Executable.** Both steps are "Check" actions; the target is the screen named in the title. Granularity: bundled (step 1 covers the message and "other UI components"). Feature-status references: none.

**C2: Partial.** Declared: the state "credentials configured" (title). Undeclared needs: a browser the product treats as unsupported and which one that is (E3).

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | Infotext: "The product may not work properly in this web browser. We recommend using Google Chrome or Mozilla Firefox." | P, Spec, Obj | NC, K-7 |
| S2 | Other UI components are the same as screen A2 | P, **Ref** (a pointer to another screen), Jdg ("same" has no criterion) | NC, K-7 (the knowledge records the login screen only in the browser it was observed in) |
| L1, L2 | Language sentence | rule 2 | NV, K-1, K-11 (L2) |

C7 summary: 0 supported, 0 partly, 2 not covered, 2 not verifiable.

**C4:** D1 none; D2 none; D3 none; D4 none; D5 none; D6 configured product [Stated]; D7 an unsupported browser [Unstated] and locale [Stated]; D8 none. **Side-effect class: None.**
**C5: UI-only** [E3].
**C6: Repeatable** [E3].
**C8 case level:** **Needs human judgment** (L1, L2, S2). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S1 (Blocked: knowledge primary; environment secondary: the project runs Chromium only and the unsupported browser is not named); Needs human judgment: S2, L1, L2.

Findings: none. (S2 is a presentation pointer; the 3.3 table does not classify it, so it is recorded as a property and listed in section 9.)
Risks: **R-98512-1** trigger: automating the case in the project's single browser; effect: the unsupported condition cannot occur, or is imitated in a way that may not match what the product tests; scope: this case. [E3]
Knowledge gaps: K-1, K-7, K-11.
Open questions: **Q-98512-1** which browsers the product treats as unsupported. **Q-98512-2** whether the browser used by the project counts as supported.

### 3.5 NJM-98516: Product start screens UI (server is not ready) - K1: The system is starting

Case: NJM-98516  Area: Authentication  Stratum: Product start screens UI  (2 steps)

**Intent: Mixed** [E1]: the text (presentation) and the display condition and automatic redirect (functional).

**C1: Executable.** Both steps are "Check" actions. Granularity: bundled. Actions the expected result needs but the step does not state: starting the product and waiting for the redirect (E3). Feature-status references: none.

**C2: Absent.** Needs: a way to make the product start (E3), permission to do it (E3), and a window in which to observe the screen (E3). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | The screen is shown while the system is starting | F, Spec, Obj | NC, K-8 |
| S2 | Text "Starting, please wait..." | P, Spec, Obj | NC, K-8 |
| S3 | The screen redirects to the login screen automatically once the product has started | F, Spec, Obj | NC, K-8 |
| L1, L2 | Language sentence | rule 2 | NV, K-1, K-11 (L2) |

C7 summary: 0 supported, 0 partly, 3 not covered, 2 not verifiable.

**C4:** D1 none; D2 none; D3 rights to restart the product [Unstated]; D4 none; D5 the starting window [Implied]; D6 starting state [Stated]; D7 locale [Stated]; D8 a product restart [Implied]. **Side-effect class: Irreversible or shared-environment impact** [E3: the state exists only while the product restarts, which affects every user].
**C5: `UNKNOWN(ambiguous)`**: how the state is reached is not stated and the knowledge does not record a restart from the UI.
**C6: Transient-state** [E1]; **Time-dependent** [E3].
**C8 case level:** **Needs human judgment** (L1, L2). Readiness **Not applicable**.
Statement-level view: Suitability `UNKNOWN` (C5): S1, S2, S3; Needs human judgment: L1, L2. Readiness for S1 to S3: `UNKNOWN`, with Blocked: knowledge and Blocked: environment as the known blockers.

Findings: none.
Risks: **R-98516-1** trigger: restarting the product to see the screen; effect: every session on the instance is interrupted; scope: shared instance. [E3] **R-98516-2** trigger: observing a short-lived screen; effect: a check may miss it or catch a different state; scope: S1 to S3. [E1, E3]
Knowledge gaps: K-1, K-8, K-11.
Open questions: **Q-98516-1** how the starting state is produced without system access, and how long the screen is visible. **Q-98516-2** the identifier K1 is used here for the starting screen, and "K1-2FA (configure 2FA)" appears in NJM-98473; whether these are separate screens with a shared prefix is not stated.

### 3.6 NJM-98491: Disabled Login - J1: Disabled tenant screen

Case: NJM-98491  Area: Authentication  Stratum: Disabled Login  (2 steps)

**Intent: Mixed** [E1]: the condition for showing the screen (functional), the warning text and the contact information (presentation).

**C1: Executable.** Both steps are "Check" actions; the target is screen J1. Granularity: bundled. Actions needed but not stated: signing in as a tenant-level user of a disabled tenant (E3). Feature-status references: none.

**C2: Absent.** Needs: a multi-tenant product (E3), a disabled tenant (E1), a tenant-level user with correct credentials (E1), and both a configured and an unconfigured contact-information state (E1). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | "Shall be disabled to tenant level users" when the credentials are correct and the tenant is disabled | F, Spec; consistency `UNKNOWN(ambiguous)`: the title and the rest read as "displayed", the text says "disabled" | NC, K-5 |
| S2 | Warning text with the placeholders [service/product] | P, Spec, Jdg (the substitution rule is not stated) | NC, K-5 |
| S3 | Contact information is shown only if configured | F, Spec, Obj | NC, K-5 |
| L1, L2 | Language sentence | rule 2 | NV, K-1, K-11 (L2) |

C7 summary: 0 supported, 0 partly, 3 not covered, 2 not verifiable.

**C4:** D1 multi-tenancy and contact information [Stated]; D2 none; D3 tenant-level user, disabled tenant [Stated]; D4 contact information configured or not [Stated]; D5 none; D6 none; D7 locale [Stated]; D8 disabling a tenant for the set-up, effect on the tenant's users [`UNKNOWN(absent)`]. **Side-effect class: None** (the steps only observe).
**C5: UI-only** [E3].
**C6: Repeatable** [E3] once the state exists.
**C8 case level:** **Needs human judgment** (L1, L2, S2). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S3 (Blocked: knowledge primary; environment secondary: multi-tenant instance availability unknown); Suitability `UNKNOWN`: S1; Needs human judgment: S2, L1, L2.

Findings: **F-98491-1** (C3, misleading wording): S1 says the screen "shall be disabled to tenant level users" while the title and the case's purpose describe a screen that is shown; the sentence can be read two ways [E1].
Risks: **R-98491-1** trigger: disabling a tenant to set up the state; effect: that tenant's users lose service until it is enabled; scope: shared multi-tenant instance. [E3]
Knowledge gaps: K-1, K-5, K-11.
Open questions: **Q-98491-1** the intended meaning of "disabled" in S1. **Q-98491-2** which of "service" or "product" replaces the placeholders, and when.

### 3.7 NJM-98477: Incorrect credentials - B1: Incorrect Credentials Provided

Case: NJM-98477  Area: Authentication  Stratum: Incorrect credentials  (2 steps)

**Intent: Mixed** [E1]: warning text and highlighting (presentation); the display condition, attempt counting and the C2 screen after five failures (functional).

**C1: Partly executable.** Step 1's action field reads "Shall be displayed in case the user has provided a wrong username and/or password": a requirement, not an action. Step 2 is a "Check" action. Granularity: bundled. Actions needed but not stated: entering wrong credentials and repeating the attempt (E3). Feature-status references: none.

**C2: Absent.** Needs: a username and a wrong password, or a wrong username (E1); the ability to make five failed attempts within five minutes from one client address (E1); a counter in a known state (E3); a second client address to check that counting is per address (E3, S4). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | The screen is shown for a wrong username and/or password | F, Spec, Obj | NV [E2: ui.authentication-flows, Not verified: wrong credentials] K-3 |
| S2 | Warning text "Incorrect credentials." | P, Spec, Obj | NV, K-3 |
| S3 | Both the password and the username field are highlighted | P, Spec, Jdg (no criterion for "highlighted") | NV, K-3 |
| S4 | The server counts unsuccessful attempts per user IP address | F, Spec, Obj only together with S5 and a second address (E3) | NV, K-3 |
| S5 | Five consecutive failures within five minutes display screen C2 | F, **Ref** for the outcome (C2 is not described in the case): weak; the trigger is Spec | NV, K-3 |
| L1, L2 | Language sentence | rule 2 | NV, K-1, K-11 (L2) |

C7 summary: 0 supported, 0 partly, 7 not verifiable (5 wrong-credentials, 2 language).

**C4:** D1 attempt counting and the C2 screen [Stated]; D2 none; D3 none; D4 a valid user [Implied]; D5 five-minute window [Stated]; D6 none; D7 locale [Stated]; D8 the counter keeps failures, per address [Stated]. **Side-effect class: Irreversible or shared-environment impact** [E3]: the counter is per client address, so failures count against everything behind that address; the case does not say what C2 does, how long it lasts or how the counter resets.
**C5: UI-only** [E1].
**C6: State-consuming** [E1, E3]; **Time-dependent** [E1].
**C8 case level:** **Needs human judgment** (L1, L2, S3, S5). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S1, S2, S4 (Blocked: knowledge primary; environment secondary: counter and C2 side effect); Needs human judgment: S3, S5, L1, L2.

Findings: **F-98477-1** (C1): the action field of step 1 holds a requirement instead of an action [E1]. **F-98477-2** (C3, weak expected result): S5 gives screen C2 only as an identifier; no text or property of it is stated [E1].
Risks: **R-98477-1** trigger: five failed attempts; effect: the C2 state may block the client address used by every other test, for an unknown time; scope: shared lab instance and address. [E1 + E3]
Knowledge gaps: K-1, K-3, K-11.
Open questions: **Q-98477-1** what screen C2 shows, whether the fifth or the sixth failure triggers it, how long it lasts, and what resets the counter.

### 3.8 NJM-104803: Logout section - Profile

Case: NJM-104803  Area: Authentication  Stratum: Logout section  (1 step)

**Intent: Presentation** [E1]: the expected result is about language, breaking UI and truncation.

**C1: Not executable.** The only step reads "Profile": a bare label (rule 3), so no step is an action. (`ui.authentication-flows`, Sign-out, shows Profile is a link in the Logout menu; that is E2 and does not make the step an action.) Feature-status references: none.

**C2: Absent.** Need: values long enough to be truncated (E3, from "reasonable truncation"). Declared: none. (A signed-in user is the baseline and is not counted.)

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | The UI is displayed in the installer's selected language | P, Gen, Jdg; the screen observed is **not stated** ("Profile" may be the menu entry or what it opens) → finding | NV [E2: ui.authentication-flows, Not verified: what the Profile link opens; other languages] K-1, K-9 |
| S2 | No breaking UI | P, Gen, Jdg; scope not stated | NV, K-9 |
| S3 | Reasonable truncation | P, Gen, Jdg ("reasonable" has no criterion); scope not stated | NV, K-9 |

C7 summary: 0 supported, 0 partly, 3 not verifiable.

**C4:** D1 none; D2 none; D3 whether the entry differs by role [`UNKNOWN(absent)`]; D4 long values [Implied]; D5 none; D6 none; D7 locale [Stated]; D8 none. **Side-effect class: None.**
**C5: UI-only** [E3].
**C6: Repeatable** [E3]; **Data-dependent** [E3, truncation depends on the length of the displayed values].
**C8 case level:** **Needs human judgment** (S1 to S3). Readiness **Not applicable**. Statement-level view: Needs human judgment for all three.

Findings: **F-104803-1** (C1): the only step is a bare label with no operation [E1]. **F-104803-2** (C3, weak expected result): S1 to S3 are generic presentation sentences and the case does not state which screen or element they apply to, so the "scope observed" condition of the 3.3 table is not met [E1].
Risks: none identified.
Knowledge gaps: K-1, K-9.
Open questions: **Q-104803-1** what "Profile" refers to: the menu entry, or the page or dialog it opens.

### 3.9 NJM-98494: Remote tenant

Case: NJM-98494  Area: Authentication  Stratum: Remote tenant  (2 steps)

**Intent: Mixed** [E1]: the display condition, attempt counting and screen C2 (functional); the warning text and highlighting (presentation).

**C1: Partly executable.** Step 1's action field is a condition and a requirement ("In case a user is tryin to log in the MSP's product instance using the remote tenant user credentials, B3 screen below shall be displayed"), and it points to a screen "below" that the case text does not contain (an image or attachment would not be read in this analysis). Step 2 is a "Check" action. Feature-status references: none.

**C2: Absent.** Needs: a service-provider (MSP) instance (E1); a remote tenant and its user credentials (E1); a counter in a known state and five attempts within five minutes (E1, E3). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | Screen B3 is shown for remote-tenant credentials on the MSP instance | F, Spec, Obj | NC, K-5 |
| S2 | Warning text "Access denied." | P, Spec, Obj | NC, K-5 |
| S3 | Both fields are highlighted | P, Spec, Jdg | NC, K-3 |
| S4 | The server counts unsuccessful attempts per user IP address | F, Spec, Obj only together with S5 and a second address (E3) | NV, K-3 |
| S5 | Five consecutive failures within five minutes display screen C2 | F, **Ref** for the outcome: weak; the trigger is Spec | NV, K-3 |
| L1, L2 | Language sentence | rule 2 | NV, K-1, K-11 (L2) |

C7 summary: 0 supported, 0 partly, 3 not covered, 4 not verifiable.

**C4:** D1 attempt counting and C2 [Stated]; D2 the remote tenant's instance [Implied]; D3 MSP, remote tenant user [Stated]; D4 remote tenant credentials [Stated]; D5 five-minute window [Stated]; D6 none; D7 locale [Stated]; D8 the counter keeps failures, per address [Stated]. **Side-effect class: Irreversible or shared-environment impact** [E3, as R-98477-1].
**C5: UI-only** [E3]: the steps are performed on the login screen; the set-up needs a remote tenant.
**C6: State-consuming** and **Time-dependent** [E1, E3].
**C8 case level:** **Needs human judgment** (L1, L2, S3, S5). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S1, S2, S4 (Blocked: knowledge primary; environment secondary); Needs human judgment: S3, S5, L1, L2.

Findings: **F-98494-1** (C1): the action field of step 1 holds a condition and a requirement, and refers to a "B3 screen below" that is not in the case text [E1]. **F-98494-2** (C3, weak expected result): S5 gives screen C2 only as an identifier [E1].
Risks: **R-98494-1** the same trigger and effect as R-98477-1 for attempts on this screen. [E1 + E3] **R-98494-2** trigger: running this case and NJM-98477 within five minutes; effect: both cases state one per-address counter, so failures add up and C2 can appear earlier than either case expects; scope: the two cases and the shared address. [E1 of both cases; cross-case, see section 7]
Knowledge gaps: K-1, K-3, K-5, K-11.
Open questions: **Q-98494-1** what the "B3 screen below" is (not in the case text; attachments are outside the allowed sources).

### 3.10 NJM-98496: Two-factor authentication - A-2FA-3: Verification options

Case: NJM-98496  Area: Authentication  Stratum: Two-factor authentication  (2 steps)

**Intent: Mixed** [E1]: header and texts (presentation); the Send verification button, the failure text, the email message and the validity period (functional).

**C1: Executable.** Both steps are "Check" actions; the target is screen A-2FA-3. Granularity: bundled (step 1 holds fourteen checks). Actions needed but not stated: choosing an address, clicking Send verification, waiting 10 minutes, causing a mail failure (E3). Feature-status references: none.

**C2: Absent.** Needs: a user with 2FA enabled and at least one, preferably several, email addresses added (E1, E3); working outgoing mail and access to the mailbox (E3); a way to make sending fail (E3); email-notification recipients and a Branding setting, for the "if configured" and "see Branding" statements (E1). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | Header "Verification Options" | P, Spec, Obj | NV, K-2 |
| S2 | Text "Email" | P, Spec, Obj | NV, K-2 |
| S3 | Text "You can receive a verification code via email." | P, Spec, Obj | NV, K-2 |
| S4 | Radio-button list of the email addresses added by the user | P+F, Spec, Obj | NV, K-2 |
| S5 | Send verification sends the code to the selected address and opens A-2FA-2 | F, Spec, Obj | NV, K-2 |
| S6 | On a send failure the text "Failed to send email." is shown | P, Spec, Obj | NV, K-2 |
| S7 | "See Figma" | P, **Ref**, Jdg | NC, K-2 |
| M1 | Email sender and from-name (placeholders and "see Branding") | P, Spec with placeholders, Jdg | NC, K-12 |
| M2 | Email recipients: the user and the notification recipients if configured | F, Spec, Obj; **mismatched** with the step's target (the screen) | NC, K-12 |
| M3 | Email subject "Email address verification" | P, Spec, Obj; **mismatched** with the step's target | NC, K-12 |
| M4 | Email body with the sample code and "The code will expire in 10 minutes" | P, Spec, Obj; **mismatched** with the step's target | NC, K-12 |
| V | The code is valid for 10 minutes | F, Spec, Obj; **mismatched** with the step's target | NV, K-2 |
| L1, L2 | Language sentence | rule 2 | NV, K-1, K-11 (L2) |

C7 summary: 0 supported, 0 partly, 5 not covered, 9 not verifiable.

**C4:** D1 2FA email method, notification recipients, Branding [Stated]; D2 outgoing mail, mailbox [Stated], a mail failure [Implied]; D3 none; D4 several addresses [Implied]; D5 ten-minute validity [Stated]; D6 none; D7 locale [Stated]; D8 emails go to real recipients [Stated, "recipient(s) for email notifications"]. **Side-effect class: Irreversible or shared-environment impact** [E1: sent mail cannot be recalled and may reach notification recipients].
**C5: UI with non-UI support** [E1]: the mailbox and a mail failure.
**C6: Time-dependent** [E1]; **State-consuming** [E3, each send issues a code].
**C8 case level:** **Needs human judgment** (L1, L2, S7, M1). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S1, S2, S3, S4 (Blocked: knowledge primary; environment secondary); Suitable with non-UI support: S5, S6 (Blocked: knowledge primary; environment secondary), and M2, M3, M4, V (**Blocked: case quality** primary, because of F-98496-1; then knowledge and environment); Needs human judgment: S7, M1, L1, L2.

Findings: **F-98496-1** (C3, inconsistent expected result): the step checks the screen, but M2, M3, M4 and V describe the email and the life of the code, which are not on the screen [E1].
Risks: **R-98496-1** trigger: clicking Send verification; effect: real email reaches the user and, if configured, the notification recipients; scope: external people. [E1] **R-98496-2** trigger: checking the 10-minute validity; effect: a wait of more than ten minutes and a boundary that depends on timing; scope: V. [E1, E3]
Knowledge gaps: K-1, K-2, K-11, K-12.
Open questions: **Q-98496-1** the recipients of the message include "recipient(s) for email notifications" and the NJM-98495 infotext says the code is sent to the selected address; whether notification recipients are meant to receive the login code is not stated.

### 3.11 NJM-98479: Password reset - D1: Password Reset

Case: NJM-98479  Area: Authentication  Stratum: Password reset  (4 steps)

**Intent: Mixed** [E1]: placeholder (presentation); link behavior and Done behavior (functional).

**C1: Partly executable.** Step 4 is a "Check" action. Steps 2 and 3 are bare labels (rule 3). Step 1 (`Enter your username or email field:`) can be read as an instruction to type or as the field's label (its text equals the placeholder), so it is `UNKNOWN(ambiguous)` and not an action. Granularity: one element per step. Feature-status references: none.

**C2: Absent.** Needs: a way to reach D1 (E3; `ui.authentication-flows` records the "Forgot the password?" link, the case does not); a valid and an invalid value for the field (E3); a real or throw-away account for the Done click (E3). Declared: none.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| S1 | Placeholder "Enter your username or email" | P, Spec, Obj | **Sup** [E2: ui.authentication-flows, "Forgot the password?" view] |
| S1b | "See requirements in Common for the Product" | F, **Ref**: weak | NC, K-10 |
| S2 | The "Forgot username and email?" link shows screen G1 (contact administrator) | F, Spec, Obj | NC, K-4 (the view in the knowledge has underlined text "Forgot the username or email?"; what clicking it does is not recorded) |
| S3a | Done is disabled when the field value is invalid | F, Spec, **Jdg** ("invalid" is defined only by a pointer) | **Part** [E2: same section: DONE is disabled at first; invalid values are not covered] |
| S3b | Clicking Done evaluates the value as a username or an email address | F, **Gen** (no observable outcome), NotV | NV [E2: ui.authentication-flows, Not verified: what DONE does] K-4 |
| L1 to L4 | Language sentence in four steps | rule 2 | NV, K-1, K-11 (L4) |

C7 summary: 1 supported, 1 partly supported, 2 not covered, 5 not verifiable (1 DONE behavior, 4 language).

**C4:** D1 password reset [Implied]; D2 mail, if Done sends one [`UNKNOWN(absent)`]; D3 none stated; D4 valid and invalid values [Implied]; D5 none; D6 none; D7 locale [Stated]; D8 Done with a real value may start a reset [`UNKNOWN(absent)`]. **Side-effect class: UNKNOWN(absent)** (S3b).
**C5: UI-only** [E3] (nothing stated needs another interface).
**C6: Repeatable** for S1, S2, S3a [E3]; **UNKNOWN(not-tested)** for S3b.
**C8 case level:** **Needs human judgment** (L1 to L4, S3a, S3b). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S1 (**Ready after information**: the only gap is the undeclared way to reach D1, which `ui.authentication-flows` records), S2 (**Blocked: knowledge**, no other blocker; a near candidate at statement level); Needs human judgment: S1b, S3a, S3b, L1 to L4.

Findings: **F-98479-1** (C1): steps 2 and 3 are bare labels and step 1 is ambiguous between an instruction and a label [E1]. **F-98479-2** (C3, weak expected result): S1b is a pointer to another document [E1]. **F-98479-3** (C3, weak expected result): S3a depends on "invalid", which the case does not define [E1]. **F-98479-4** (C3, weak expected result): S3b states an action ("evaluate") without an observable outcome [E1].
Risks: **R-98479-1** trigger: clicking Done with a real account name or email; effect: unknown, possibly a reset request or an email to a real user; scope: that account. [E3]
Knowledge gaps: K-1, K-4, K-10, K-11.
Open questions: **Q-98479-1** the case names the link "Forgot username and email?" and `ui.authentication-flows` records the text "Forgot the username or email?"; whether they denote the same link and which wording is current is not settled (neither side is declared wrong). **Q-98479-2** what makes a value invalid (the pointer "Common for the Product" is outside the allowed sources).

### 3.12 NJM-98473: Default login screen - A2: Credentials are Configured

Case: NJM-98473  Area: Authentication  Stratum: Default login screen  (6 steps)

**Intent: Mixed** [E1]: defaults, placeholders and the footer (presentation); focus, Log In enabling and the outcomes of a Log In click (functional).

**C1: Partly executable.** All six steps are "Check" actions, but step 1's expected result holds "(to be implemented with NJM-51374)", so part of the case depends on something the case marks as not yet available. Granularity: step 5 bundles six checks and needs four kinds of sign-in (E3). Feature-status references: **unimplemented** (step 1).

**C2: Partial.** Declared: the state "Credentials are Configured" (title). Undeclared needs for the Log In outcomes: a user without 2FA, a user with 2FA configured, a user with 2FA enabled but not configured, a tenant user or service-provider user for the Tenants dashboard, a product that still needs the Configuration Wizard, and a wrong-credentials attempt (all E1). The statements about defaults, focus and placeholders need nothing beyond an unauthenticated browser.

| Id | Statement | C3 | C7 |
|---|---|---|---|
| L1 to L6 | Language sentence in the six steps | rule 2 | NV, K-1, K-11 (L6) |
| S1 | Username: common requirements by pointer ("see ... Common for the Product") | F, **Ref**: weak | NC, K-10 |
| S2 | Username accepts the character "@" (after "(to be implemented with NJM-51374)") | F, Spec, Obj | NC, K-10 |
| S3 | Username is focused after the page opens | F, Spec, Obj | **Sup** [E2: ui.authentication-flows, Login form rules] |
| S4 | Username is empty by default | P, Spec, Obj | NC, K-10 (default content is only implied by the LOG IN observation, which is E3) |
| S5 | Username placeholder "Username" | P, Spec, Obj | **Sup** [E2: ui.login, Controls] |
| S6, S7 | Password: common requirements by pointer, and "Common UI - Password Input" by pointer | F, **Ref** (two pointers): weak | NC, K-10 |
| S8 | Password is empty by default | P, Spec, Obj | NC, K-10 |
| S9 | Password placeholder "Password" | P, Spec, Obj | **Sup** [E2: ui.login, Controls] |
| S10 | Remember me is unchecked by default | P, Spec, Obj | **Sup** [E2: ui.login, Controls; ui.authentication-flows, Remember me] |
| S11 | The "Forgot password?" link opens screen D1 | F, Spec, Obj (the identifier resolves to NJM-98479, section 7) | **Part** [E2: ui.authentication-flows, "Forgot the password?" view: the link opens a reset view; the identifier D1 is not in the knowledge] |
| S12 | Log In is disabled when the Username field is empty | F, Spec, Obj | **Sup** [E2: ui.authentication-flows, Login form rules] |
| S13 | Correct credentials show the Configuration Wizard, the Overview or the Tenants dashboard "accordingly" | F, Spec, **Jdg** (condition behind "accordingly" not stated): weak | **Part** [E2: ui.authentication-flows, Login form rules, ui.auth-session: valid sign-in lands on `/c/overview`; Wizard and Tenants dashboard not covered] |
| S14 | 2FA enabled and configured shows screen A-2FA-2 | F, Spec, Obj | NV, K-2 |
| S15 | 2FA enabled and not configured shows screen K1-2FA | F, Spec, Obj | NV, K-2 |
| S16 | Wrong username and/or password shows screen B1 | F, Spec, Obj | NV [E2: ui.authentication-flows, Not verified: wrong credentials] K-3 |

Decisive statements: 6 language + 16 others = 22. C7 summary: **5 supported** (S3, S5, S9, S10, S12), **2 partly supported** (S11, S13), 6 not covered (S1, S2, S4, S6, S7, S8), 9 not verifiable (6 language, S14, S15, S16).

**C4:** D1 2FA, multi-tenancy, first-run wizard [Stated]; D2 none; D3 tenant and service-provider users [Stated]; D4 users in several states [Stated]; D5 none; D6 a product that needs the wizard [Stated]; D7 locale [Stated]; D8 a sign-in creates a session that the Log out of `ui.authentication-flows` (Sign-out) ends; a wrong attempt feeds the per-address counter described in NJM-98477 (cross-case, Unstated here). **Side-effect class: Reversible side effect** [E2: ui.authentication-flows, Sign-out]; see R-98473-1 for the counter.
**C5: UI-only** [E1]: no statement needs another interface.
**C6: Repeatable** [E3] for the screen statements.
**C8 case level:** **Needs human judgment** (six language statements, S1, S6, S7 and S13 are By judgment or reference-only). Readiness **Not applicable**.
Statement-level view: Suitable at the UI level: S2, S3, S4, S5, S8, S9, S10, S11, S12, S14, S15, S16 (12). Needs human judgment: 6 language statements, S1, S6, S7, S13 (10).
Readiness of the 12: **Ready**: S3, S5, S9, S10, S11, S12 (six statements; S3, S5, S9, S10, S12 are Supported, S11 is partly supported, which the rubric does not list as a blocker); **Blocked: knowledge**: S2, S4, S8, S14, S15, S16. S2 also has an environment doubt (the feature is marked to be implemented); S14 to S16 also depend on users in states that are not declared; S16 touches the per-address counter. Near candidates at statement level (suitable and blocked only by knowledge): S4 and S8.

Findings: **F-98473-1** (C1, feature status): the marker "(to be implemented with NJM-51374)" is followed by a list ("It shall accept '@'", focus, empty, placeholder) and the case does not say which items it covers [E1]. **F-98473-2** (C3, weak expected result): S1, S6 and S7 are pointers to other documents [E1]. **F-98473-3** (C3, weak expected result): S13 gives three outcomes with "accordingly" and no mapping [E1].
Risks: **R-98473-1** trigger: the wrong-credentials attempt of step 5; effect: it adds to the per-address counter that NJM-98477 describes, which this case does not declare; scope: the test client address and the shared account. [E1 of NJM-98477, cross-case]
Knowledge gaps: K-1, K-2, K-3, K-4, K-5, K-6, K-10, K-11.
Open questions: **Q-98473-1** the case names the link "Forgot password? Link" and `ui.login` records "Forgot the password?"; whether they denote the same link is not settled. **Q-98473-2** which statements the NJM-51374 marker covers. **Q-98473-3** the condition that selects the Wizard, the Overview or the Tenants dashboard. **Q-98473-4** the case points to "Common UI - Password Input" for the Password field, and NJM-98472 spells that input out with a show/hide toggle; `ui.login` records no toggle on the login Password field and does not say there is none, so whether the login field has one is `UNKNOWN(absent)`.

## 4. C1 to C8 results by category (12 cases; counts per category, never a total)

| Criterion | Value | Cases | n |
|---|---|---|---|
| Intent (step 0) | Mixed | all except two | 10 |
| | Presentation | 98512, 104803 | 2 |
| C1 | Executable | 98495, 98512, 98516, 98491, 98496 | 5 |
| | Partly executable | 98483, 98472, 98477, 98494, 98479, 98473 | 6 |
| | Not executable | 104803 | 1 |
| C2 | Complete | none | 0 |
| | Partial | 98512, 98473 | 2 |
| | Absent | 98495, 98483, 98472, 98516, 98491, 98477, 98494, 98496, 98479, 104803 | 10 |
| | N/A | none | 0 |
| C3 (cases with a finding) | weak expected result | 98495, 98483, 98472, 98477, 98494, 98479, 98473, 104803 | 8 |
| | inconsistent (mismatched) | 98472, 98496 | 2 |
| | ambiguous wording | 98491 | 1 |
| | missing (empty) | none | 0 |
| | no C3 finding | 98512, 98516 | 2 |
| C3 property | limited verifiability (language sentence, scope stated) | every case except 104803 | 11 |
| C4 side-effect class | None | 98512, 98491, 104803 | 3 |
| | Reversible side effect | 98473 | 1 |
| | Irreversible or shared-environment impact | 98472, 98516, 98477, 98494, 98496 | 5 |
| | UNKNOWN(absent) | 98495, 98483, 98479 | 3 |
| C5 | UI-only | 98483, 98512, 98491, 98477, 104803, 98494, 98479, 98473 | 8 |
| | UI with non-UI support | 98495, 98472, 98496 | 3 |
| | Non-UI | none | 0 |
| | UNKNOWN(ambiguous) | 98516 | 1 |
| C6 (a case can hold several) | Repeatable | 98512, 98491, 98473, 104803, 98479 (partly) | 5 |
| | State-consuming | 98495, 98483, 98472, 98477, 98494, 98496 | 6 |
| | Time-dependent | 98495, 98477, 98494, 98496, 98516 | 5 |
| | Transient-state | 98516 | 1 |
| | Data-dependent | 104803 | 1 |
| | UNKNOWN(not-tested) | 98483, 98479 | 2 |
| C7 (118 decisive statements) | Supported | 98479 (1), 98473 (5) | 6 |
| | Partly supported | 98479 (1), 98473 (2) | 3 |
| | Contradicted | none | 0 |
| | Not covered | 98483 5, 98472 15, 98512 2, 98516 3, 98491 3, 98494 3, 98496 5, 98479 2, 98473 6 | 44 |
| | Not verifiable with current knowledge | 98495 8, 98483 5, 98472 9, 98512 2, 98516 2, 98491 2, 98477 7, 104803 3, 98494 4, 98496 9, 98479 5, 98473 9 | 65 |
| | Out of knowledge scope | none (tenant and first-run statements are in an area the knowledge does not cover, so they are Not covered) | 0 |
| C8 case level, suitability | Needs human judgment | all 12 | 12 |
| C8 case level, readiness | Not applicable | all 12 | 12 |

The 65 not-verifiable statements include 39 language statements.

Statement-level C8 (118 statements): Suitable at the UI level 33, Suitable with non-UI support 14, `UNKNOWN` 5, Needs human judgment 66. Of the 47 suitable statements: Ready 6 (all NJM-98473), Ready after information 1 (NJM-98479 S1), Blocked: case quality 4 (NJM-98496 M2, M3, M4, V), Blocked: knowledge 36.

## 5. Register of findings, risks and open questions (index; full text is in the per-case sections)

| Type | Count | Ids |
|---|---|---|
| Findings | 21 | F-98495-1; F-98483-1, -2; F-98472-1, -2, -3; F-98491-1; F-98477-1, -2; F-104803-1, -2; F-98494-1, -2; F-98496-1; F-98479-1, -2, -3, -4; F-98473-1, -2, -3 |
| Risks | 16 | R-98495-1, -2; R-98483-1; R-98472-1, -2; R-98512-1; R-98516-1, -2; R-98491-1; R-98477-1; R-98494-1, -2; R-98496-1, -2; R-98479-1; R-98473-1 |
| Knowledge gaps | 12 | K-authentication-1 to -12 (section 2) |
| Open questions | 25 | Q-98495-1 to -3; Q-98483-1 to -3; Q-98472-1 to -3; Q-98512-1, -2; Q-98516-1, -2; Q-98491-1, -2; Q-98477-1; Q-104803-1; Q-98494-1; Q-98496-1; Q-98479-1, -2; Q-98473-1 to -4 |

Findings by pattern: (a) an action field that is a requirement, a condition or a bare label (F-98483-1, F-98477-1, F-104803-1, F-98494-1, F-98479-1); (b) steps that depend on features marked not implemented (F-98472-1, F-98473-1); (c) expected results that are only pointers (F-98472-2, F-98477-2, F-98494-2, F-98479-2, F-98473-2); (d) expected results with no observable outcome, an undefined condition, or no stated scope (F-98495-1, F-98483-2, F-98479-3, F-98479-4, F-98473-3, F-104803-2); (e) mismatched or ambiguous wording (F-98472-3, F-98496-1, F-98491-1).

## 6. Automation suitability and readiness

**Case level (approved rules, applied literally): 0 automation candidates, 0 near candidates.** Every case contains a decisive statement that is By judgment or Not verifiable (at least the language sentence, which is only a general sentence), so rule 2 of the suitability table ("Needs human judgment") applies to all 12 and readiness is Not applicable. A case that needs human judgment is never a candidate.

**Statement-level view (informational; rubric part 4 evaluates C8 per statement for Mixed cases).** This is not a classification of any case.

| Statement-level result | Statements | Why |
|---|---|---|
| Ready (6) | NJM-98473 S3 focus, S5 Username placeholder, S9 Password placeholder, S10 Remember me unchecked, S12 Log In disabled when Username is empty, S11 Forgot link opens D1 | UI-only and Objective; needs nothing beyond an unauthenticated browser; five are Supported by the knowledge, S11 is partly supported (the rubric does not list partly supported as a blocker; Q-98473-1 remains open) |
| Ready after information (1) | NJM-98479 S1 reset-input placeholder | Supported; the only gap is the undeclared way to reach the view, which the knowledge records |
| Near candidates (3) | NJM-98473 S4 and S8 (empty by default), NJM-98479 S2 (link shows G1) | Suitable at the UI level, blocked only by knowledge, no other blocker |
| Blocked: case quality (4) | NJM-98496 M2, M3, M4, V | F-98496-1 |
| Blocked: knowledge (rest of the suitable statements) | two-factor, wrong-credentials, tenancy, first-run, password-reset and email statements | K-authentication-2 to -8, -10, -12 |

NJM-98473 is the only case where a coherent set of statements is both objective and supported. The case as written still carries the language sentence, the three pointer statements and the "accordingly" statement, so it is not a case-level candidate. Cases with the strongest environment blockers (not candidates under either view): NJM-98477 and NJM-98494 (shared per-address counter), NJM-98472 (one-shot account creation), NJM-98516 (restart), NJM-98496 (real email), NJM-98495 (backup codes, 2FA users).

## 7. Cross-case consistency observations (secondary check; no C value was lowered because of them)

1. **Same localization sentence** in all cases (NJM-104803 words it differently and adds two statements). The shared weakness is limited verifiability, recorded per case as a property.
2. **Duplicated paragraph.** The counting and C2 statements are identical in NJM-98477 (B1) and NJM-98494 (B3). Neither case declares the counter's state. Recorded as R-98494-2 and R-98473-1; the duplication itself is not a deficiency.
3. **References between cases.** NJM-98473 points to D1 (NJM-98479), B1 (NJM-98477), A-2FA-2 (NJM-98495) and K1-2FA (not selected). NJM-98495 points to A-2FA-3 (NJM-98496) and NJM-98496 opens A-2FA-2. NJM-98512 points to A2 (NJM-98473). The selection contains D1, B1, A2, A-2FA-2 and A-2FA-3; it does not contain C2, F1, G1 or K1-2FA, which several cases name (no case or knowledge document describes them). The references that resolve inside the selection are consistent with each other.
4. **Link naming.** Case wording and E2 wording differ for the Forgot link in two cases: Q-98473-1, Q-98479-1. Letter-case differences were ignored (convention 8).
5. **Identifier collision risk.** K1 (NJM-98516) and K1-2FA (NJM-98473): Q-98516-2.
6. **Who receives the code.** NJM-98495 says the code goes to the selected address; NJM-98496 lists the notification recipients as well: Q-98496-1.
7. **Same behavior, same weakness, same wording.** "Accordingly" (NJM-98495 S5 and NJM-98473 S13) and "Done is disabled in case the field is invalid" (NJM-98479, NJM-98483) are worded alike. Each was judged on its own text. NJM-98483 gives a length rule that can serve as the definition of "invalid" (E3), NJM-98479 gives none; that is a difference in the texts, not a lowering of either.
8. **State declarations.** Only NJM-98512 and NJM-98473 declare a state (in the title: credentials configured). No case has a pre-condition item or data (consistent with `case-inventory.md`).
9. **Remember me.** NJM-98472 says "deselected", NJM-98473 says "unchecked", for the Create Account and the login screen respectively. Different screens, so this is wording only.
10. **Show/hide toggle.** NJM-98472 spells out a toggle that NJM-98473 only points to; `ui.login` does not mention one: Q-98473-4.
11. **Precision note on the inventory.** `case-inventory.md` describes the C2 outcome of NJM-98477 and NJM-98494 as a lockout screen. The case text only says "display the C2 screen". This analysis uses "C2 screen" and treats the blocking effect as an E3 inference (R-98477-1, Q-98477-1). The approved inventory was not edited.

## 8. Notes on the work done

- The case text comes from the read-only Jira fetch of 2026-10-02 (title, description, steps; no comments or attachments). No Jira case was changed.
- Statement counts, category counts and the C7 totals (118 = 6 + 3 + 44 + 65) were checked against the per-case tables when this file was written.

## 9. Items for the owner's decision (about the method, not about the cases)

1. **Case level or statement level for the shortlist.** Part 4 of the rubric evaluates C8 per statement for Mixed cases; part 9 defines candidates per case. With the rule applied per case, no Authentication case is a candidate. Whether 3.5 should list statements (for example NJM-98473 S3, S5, S9, S10, S11, S12) is not decided here.
2. **Rubric table gaps, recorded without changing the rubric.** (a) A presentation statement that is Reference-only (NJM-98472 CI016/CI017, NJM-98496 "See Figma", NJM-98512 "same as A2") has no row in the C3 table; it was recorded as a property. (b) A presentation statement that is Specific but By judgment (placeholders in NJM-98491, "highlighted") has no row either; recorded as a property. (c) "Blocked: case quality" lists missing, inconsistent and contradictory expected results, not weak ones, so weak statements do not block readiness. (d) "Partly supported" is not a blocker in the readiness table.
3. **Per-statement dependencies.** The statement-level view uses each statement's own dependencies and the case's side-effect class only for statements that need the effect. The rubric does not say this explicitly.
