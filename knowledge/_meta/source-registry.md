# Source registry

Governance document. Created 2026-10-01. Lists each source system, how it may be used, its trust tier, and its limits. It records *whether and how a source may be used*, not what is in it. Specific items we rely on will be indexed in `sources/` when real knowledge is ingested.

Statuses below were verified during Phase 1 (Steps 1 to 6) and are current as of 2026-10-01.

## Usable sources

### S1. Live NAKIVO Director UI
- **Location:** the lab Director recorded in `PROJECT_STATUS.md` (HTTPS, port 4443; Chromium does not trust the certificate, and the issuer was not inspected).
- **Build observed:** 11.3.0.112329.
- **Access:** Playwright, with credentials from the gitignored `.env`. Credentials are never recorded.
- **Tier:** T1, for `current-ui-behavior`.
- **Use for:** actual UI structure, labels, locators and behavior.
- **Limits:** only the login page and authentication flows, the Overview page and the Activities page have been inspected so far. It is a lab instance; some features and resources may not be configured. Behavior may differ in other builds.

### S2. This project's own code and configuration
- **Location:** this repository (`playwright.config.ts`, `tests/`, `package.json`, `tsconfig.json`, `PROJECT_STATUS.md`).
- **Tier:** T1, for automation facts about this project.
- **Limits:** three tests exist (smoke, login page, authenticated login). It describes our framework only, not the NAKIVO product.

### S3. Confluence space `tst` ("NAKIVO Backup & Replication")
- **Location:** confluence.nakivo.com, space key `tst`.
- **Access:** read-only, anonymous session; page bodies are readable.
- **Tier:** T2 only for pages that are current **and** reconciled with the live UI; otherwise `intended-behavior` pending that check, or `historical`. **Terminology** from this space that has not been reconciled with the live UI is recorded as `terminology`, tier **T3** (rule set in Step 13).
- **Use for:** intended behavior and requirements, and unreconciled terminology (T3).
- **Limits:**
  - Currency varies widely by page. Of the sample read, the Job Execution page was updated 2026-08-18 (current), and the Edit Job page 2024-03-27 (needs a check against the UI).
  - Pages from before 2020, or marked OLD or DEPRECATED, are `historical` only.
  - The space has more pages than were examined; most have not been read.
  - Ingested so far: eight terms from the Definitions page (version 20, edited 2021-06-29), recorded in `product.glossary` as unreconciled T3 terminology. The page's other terms are not ingested.
  - Some pages are very large and need selective extraction.

### S4. Jira NJM (Ninja Management), Xray test cases
- **Location:** jira.nakivo.com, project NJM.
- **Access:** read-only through the available Jira tool, as the signed-in user.
- **Tier:** T4.
- **Use for:** how test cases are structured, relevant metadata, and candidate scenarios. Observed scoping fields include Product, Sub-Product, Train Ready scope, Regression scope, Automation scope, Test Repository Path, Test Type, and labels.
- **Limits:**
  - About 84,000 test cases (observed 2026-10-01); almost all are Manual type. Content quality varies and many cases are marked "Need Review".
  - Expected results are not trusted until reviewed.
  - **Comments on some issues contain lab secrets. NJM-189365 is a known case.** Never import Jira comment text (see `exclusions.md`).
  - Attachments (including the enriched test-case archives) are excluded until reviewed.

### S5. Jira NJT (Ninja Testing)
- **Location:** jira.nakivo.com, project NJT.
- **Tier:** T4, low relevance.
- **Use for:** historical context.
- **Limits:** 31 Xray test cases, almost all from 2020 to 2022, several empty or placeholders. Mostly backup-copy and deployment scenarios needing hypervisors and repositories. None cover login, dashboard, inventory or settings.

### S6. Jira issue text about the QA AI workstream
- **Location:** NJM issues including NJM-144490, NJM-165895, NJM-178594, NJM-178589 and the chain NJM-189364, NJM-189365, NJM-189366, NJM-190380.
- **Tier:** T4 for what was recorded about the workflow; **T5** for any statement about what the automation repositories contain.
- **Limits:** these are descriptions by participants, not verified code. Comments carry secrets (see S4).

### S7. Cached NAKIVO Backup & Replication API specification
- **Location:** local cache of the `nbr` tool, appliance alias `nbr-11-3-0`.
- **Version:** 11.3.0.111251 (147 services). The cache was about 14 days old when read, and a live refresh failed.
- **Tier:** T3.
- **Use for:** terminology and domain-object names **only**.
- **Limits:** not UI behavior; its build differs from the live Director's (112329); the Director under test is not a configured alias, so the spec cannot be refreshed from it.

## Unusable or out-of-scope sources

| Source | Status | Reason |
|---|---|---|
| GitHub `nakivo-stage/qaorch` | **Inaccessible** | Anonymous API returns 404 (private or absent); no GitHub credentials, `gh` or token available. Only second-hand claims exist (T5). |
| GitHub `thanh-phan-nkv/nbr_automation` | **Inaccessible** | Same as above. |
| `qad.nakivo.com` | **Out of scope** | Website QA system; no Director UI automation found. Also unreachable from this machine. |
| Google Drive | **Unavailable** | No OAuth token configured. |
| TeamCity, Upsource, Artifactory | **Unavailable** | Connections timed out. |
| Other Confluence spaces, other Jira projects | **Not relevant** | Not related to the Director UI or its QA. |
| Public NAKIVO help center | **Not verified** | One attempted URL returned 404; not otherwise checked. |

## Maintenance

Re-check each source before relying on it for a new release, and update this file and `changelog.md` when its status or limits change.
