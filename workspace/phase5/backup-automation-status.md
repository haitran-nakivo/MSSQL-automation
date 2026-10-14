# Backup automation status (Xray folders 2. Backup Scope, 2.3 Backup Copy Job Wizard, 6. Backup Encryption)

Written 2026-10-12. **Nothing here has been run.** The specs were written without connecting to NBR, to any SQL Server, or to Jira (the owner asked for code only until the environment is provided). Every locator in `pages/backup-*.page.ts`, `pages/bkA*-*.page.ts` and the matching flows comes from the UI exploration of 2026-10-07/08 (`knowledge/workflows/backup/backup-job-wizard.md`) or is a text-based guess, and must be proven by a first real run. Xray statuses, evidence and executions were not touched.

## Coverage

345 cases downloaded read-only from Xray (274 + 63 + 8). Specs: one per case, `NJM-<key>.spec.ts`, in the folder that mirrors the Xray path (340 files). `playwright test --list` shows 658 tests in 633 files (318 in 293 before this work).

| Status | Cases | Meaning |
|---|---|---|
| IMPLEMENTED | 222 | full spec; runs once the `NAKIVO_BK_*` values it needs are in .env |
| IMPLEMENTED_ENV_GATED | 62 | full spec that needs an object the lab may not have (repository type, tape, license state); ends ABORTED when it is not provided |
| PARTIAL | 56 | spec covers the UI-checkable steps; the rest (Figma/mockup comparison, report mailbox, days-long waits, restore content) is attached as `observed-outcome` or skipped, said in the header |
| NOT_AUTOMATED | 5 | no spec; reason below |

| Xray folder | Cases | Impl. | Env-gated | Partial | Not autom. |
|---|---|---|---|---|---|
| 2. Backup Scope/SQL backup type | 22 | 22 | 0 | 0 | 0 |
| 2. Backup Scope/2.2. Backup Job Wizard/Backup Execution | 21 | 11 | 10 | 0 | 0 |
| 2. Backup Scope/2.2. Backup Job Wizard/General requirements | 16 | 11 | 2 | 3 | 0 |
| 2. Backup Scope/Chain | 15 | 8 | 2 | 4 | 1 |
| 2. Backup Scope/Workflow | 19 | 15 | 1 | 3 | 0 |
| 2. Backup Scope/Step 1 - Sources/UI | 41 | 30 | 10 | 0 | 1 |
| 2. Backup Scope/Step 1 - Sources/Functional | 4 | 4 | 0 | 0 | 0 |
| 2. Backup Scope/Step 2 - Destination/UI | 61 | 53 | 7 | 1 | 0 |
| 2. Backup Scope/Step 2 - Destination/Functional | 5 | 3 | 1 | 1 | 0 |
| 2. Backup Scope/Step 3 - Schedule/UI | 20 | 15 | 1 | 4 | 0 |
| 2. Backup Scope/Step 3 - Schedule/Functional | 19 | 5 | 8 | 6 | 0 |
| 2. Backup Scope/Step 4 - Retetion (Expert)/UI | 1 | 0 | 0 | 1 | 0 |
| 2. Backup Scope/Step 4 - Retetion (Expert)/Functional | 1 | 0 | 0 | 1 | 0 |
| 2. Backup Scope/Step 4_Step 5 - Actions/UI | 5 | 4 | 0 | 1 | 0 |
| 2. Backup Scope/Step 4_Step 5 - Actions/Functional | 4 | 0 | 0 | 4 | 0 |
| 2. Backup Scope/Step 5_Step 6 - Data Transfer/UI | 11 | 9 | 1 | 1 | 0 |
| 2. Backup Scope/Step 5_Step 6 - Data Transfer/Functional | 3 | 0 | 0 | 3 | 0 |
| 2. Backup Scope/Step 6_Step 7 - Options/UI | 1 | 0 | 0 | 1 | 0 |
| 2. Backup Scope/Step 6_Step 7 - Options/Functional | 5 | 3 | 0 | 2 | 0 |
| 2.3 Backup Copy Job Wizard/Backup Copy Execution | 18 | 4 | 5 | 9 | 0 |
| 2.3 Backup Copy Job Wizard/Step 1 - Source | 8 | 7 | 0 | 0 | 1 |
| 2.3 Backup Copy Job Wizard/Step 2 - Destination | 5 | 1 | 4 | 0 | 0 |
| 2.3 Backup Copy Job Wizard/Step 3 - Schedule | 4 | 2 | 2 | 0 | 0 |
| 2.3 Backup Copy Job Wizard/Step 4 - Retention | 7 | 3 | 0 | 2 | 2 |
| 2.3 Backup Copy Job Wizard/Step 5 - Options | 7 | 7 | 0 | 0 | 0 |
| 2.3 Backup Copy Job Wizard/Backup Copy to Tape | 6 | 0 | 2 | 4 | 0 |
| 2.3 Backup Copy Job Wizard/Backup Copy to Tape Recovery/Entry Points | 4 | 0 | 4 | 0 | 0 |
| 2.3 Backup Copy Job Wizard/Backup Copy to Tape Recovery/Recovery Job Wizard | 4 | 0 | 2 | 2 | 0 |
| 6. Backup Encryption | 8 | 5 | 0 | 3 | 0 |

## Not automated (no spec)

- **NJM-154680** ([MSSQL-BK-Chain-0007] Verify Recovery to Specific Point): The case restores data into a database; without an explored restore flow and a safe restore target it would be a blind and potentially destructive script. Needs a UI exploration of the recovery wizard first (restore as a
- **NJM-154768** ([DBM-BK-UI-Source-Left Pane-0019-9] Verify No Tracking After Init): Needs an external license change in the middle of job initialization (a manual license-server action with timing that cannot be driven from the UI); the owner forbids changing licensing from tests.
- **NJM-178364** ([MSSQL-BKC-SRC-07] Verify license not counter and effect to backup copy job): Needs applying a limited-count license (license-server change) and reading its counter; not safe or repeatable in the lab.
- **NJM-178377** ([MSSQL-BKC-RET-04] Verify last log is auto-deleted only when last, expired, and unused): Needs a log recovery point that has expired by time and is the last of its chain, plus a second one held by a running recovery job; retention processing timing cannot be driven from the UI.
- **NJM-178378** ([MSSQL-BKC-RET-05] Verify a log is not deleted while it is a dependency for a later log or): Needs an expired log that is a dependency of a later log and a log held by a running recovery job; expiry and retention processing cannot be forced from the UI.

## Partial (what is not covered)

- **NJM-154723**: Asserts the observed 4-step set; the schedule-model precondition cannot be set.
- **NJM-154724**: Asserts observed steps and the inline retention.
- **NJM-154728**: Creates and deletes job NJM-154728.
- **NJM-154675**: Long: Full + 50 Log runs (up to about an hour, timeout 6,000,000 ms).
- **NJM-154677**: Creates and drops table dbo.QA_NJM154677 in the FULL database.
- **NJM-154699**: 
- **NJM-154720**: Creates and deletes job NJM-154720.
- **NJM-154707**: 
- **NJM-154708**: 
- **NJM-154714**: 
- **NJM-154784**: Does not compare with Configuration > Repositories; asserts the named repos are listed and attaches the visible texts.
- **NJM-171430**: Backup Copy Job wizard driven by guessed text locators (never opened live)
- **NJM-169536**: Figma comparison not possible; control presence/defaults/tooltip asserted
- **NJM-171475**: UI retention is time-based; pruning by last-N recovery points and alarms not checked
- **NJM-171465**: mockup comparison not possible; controls asserted
- **NJM-171453**: report mailbox cannot be read by the test
- **NJM-171454**: script execution order on the Director host cannot be observed; success with Fail-on-error asserted plus two ad hoc missing-script runs
- **NJM-171455**: script execution order cannot be observed; post-script failure texts were never recorded
- **NJM-171456**: mailbox and script order cannot be observed
- **NJM-154840**: No Figma comparison possible; observed layout labels/controls and no-overlap/no-overflow asserted.
- **NJM-154844**: Add another schedule adds inline Schedule #2 with Remove link; Figma not comparable.
- **NJM-154853**: No card: job page summary + Edit block asserted; Figma not comparable.
- **NJM-154855**: Only icon presence asserted; class/background attached; SQLD003 not comparable.
- **NJM-171433**: Steps 1-4 real; steps 5-6 replaced by an on-demand run (weekly occurrence cannot be awaited).
- **NJM-171434**: Steps 1-4 real; steps 5-6 replaced by an on-demand run (monthly occurrence not awaitable).
- **NJM-171435**: Steps 1-4 real; steps 5-6 replaced by an on-demand run (yearly occurrence not awaitable).
- **NJM-171438**: Weekly + two colliding Periodic schedules; Prioritize schedules tooltip; one backup per minute, all Full.
- **NJM-171439**: Effective from tomorrow: no run for 2.5 min; second job runs; window values saved. Start/End window enforcement not exercised.
- **NJM-171440**: Keep 3 days saved, tooltip, Run dialog text, two runs retained; enforcement (oldest removed) not checked.
- **NJM-154869**: Expected cap = min(2*CPU, floor(RAM/0.2)) computed from env. The job runs with 64 requested streams and must succeed; the number of streams used is asserted only if the job page states "N streams" (location unknown), oth
- **NJM-171457**: If the control appears, it is ticked and set from NAKIVO_BK_TRANSPORTER_LOAD_LIMIT. Load statistics not asserted.
- **NJM-171458**: Bottleneck detection ticked, run succeeds, Recover enabled, Job options shows bottleneck; the statistics location (source/network/target/proxy) is unknown: texts attached, asserted only if a "bottleneck" text exists.
- **NJM-171459**: The case <n> streams is fixed at 4.
- **NJM-171111**: Asserts presence and defaults of Job name, priority 5, acceleration/network encryption/backup encryption Disabled, checkboxes, buttons.
- **NJM-171460**: Two jobs (priority 1 and 5) on two databases are saved, run back to back, both must succeed; the processing order is attached, not asserted (parallel runs possible).
- **NJM-171464**: Sets priority 1, Network encryption, Backup encryption and asserts Network acceleration is greyed out.
- **NJM-178401**: Active-full due date cannot be waited for; the run result and tape listing are asserted, only incremental vs full content is attached.
- **NJM-178402**: Upper bound on active objects asserted via 1 s sampling of the job page rows; peak attached.
- **NJM-178403**: ABORTED unless databases > max drives; queued peak asserted when the sampler saw active rows; final success asserted.
- **NJM-178404**: Asserts both copy runs succeed and the tape listing did not shrink; before/after attached.
- **NJM-178409**: SQL backup row listed, enabled, selectable (Next enabled); all rows with disabled flags attached.
- **NJM-178412**: Steps 1-4 always run (tape recovery job + repository row).
- **NJM-191225**: Steps 1-3 asserted; 4-8 and 10 attach accepted/blocked + dialog text; eye icon asserted only if found. Accepted passwords are deleted in cleanup.
- **NJM-191230**: Steps 3 (content compare) and 4 (plaintext search on repository host) not automated; steps 5-6 accept "blocked in wizard" or "recovery Failed".
- **NJM-191231**: Step 4 (recover from an old pre-encryption point) not automated; enable/disable on a job with points, runs, recoveries of newest encrypted and unencrypted points.
- **NJM-154873**: Source chain Full+Differential created by the case. restorability of copied points is not exercised (no restore run)
- **NJM-154874**: Source chain Full+Log created by the case (FULL recovery model checked). restorability of copied points is not exercised (no restore run)
- **NJM-154875**: Full>Differential>Log chain; dependency links on the target are not shown in a listing, only the three types. restorability of copied points is not exercised (no restore run)
- **NJM-154876**: restorability of copied points is not exercised (no restore run)
- **NJM-154877**: Not re-copying the Full is asserted by the target having exactly one Full; the event text is annotated only. restorability of copied points is not exercised (no restore run)
- **NJM-178395**: Timestamps compared as date/time tokens of the listings; descriptions are not shown as separate texts, so only annotated.
- **NJM-178396**: The copy-mode setting is not known to exist for database copy jobs; step 2 asserts the wizard offers it. restorability of copied points is not exercised (no restore run)
- **NJM-178397**: Same unknown copy-mode setting; second job carries the Synthetic full mode. restorability of copied points is not exercised (no restore run)
- **NJM-178398**: One source job per database; recovery models are only read (ABORTED when wrong). Per-database split of the target listing is annotated, totals asserted.
- **NJM-178376**: Retention is set at creation (keep 1) and a newer Differential pushes the older one out; no re-opening of the job retention.
- **NJM-178379**: Source retention / immutability are not configured by the test (on-demand source job), so the exact copy is observed, not compared.

## Environment the specs need (all names are `NAKIVO_BK_*`; none is in .env yet, so every spec ends ABORTED until the owner provides them)

The host and SQL login of each source kind come from the existing `NAKIVO_MSSQL_<INSTANCE|FCI|AG|READSCALE>_*` groups. Read through `helpers/backup-env.ts` and `helpers/bkA7-env.ts`.

- **Existing Inventory items and databases:** `NAKIVO_BK_<INSTANCE|FCI|AG|READSCALE>_ITEM` (display name); databases `NAKIVO_BK_<KIND>_DB_<SIMPLE|FULL|BULK_LOGGED>` (AG / Read-Scale AG only need `_DB_FULL`: SQL Server refuses SIMPLE and BULK_LOGGED on an AG database). `NAKIVO_BK_EMPTY_INSTANCE_ITEM` / `NAKIVO_BK_EMPTY_CONTAINER_ITEM` (an item with no databases).
- **Repositories (existing, Online):** `NAKIVO_BK_REPO_PRIMARY`, `_SECONDARY`, `_EMPTY`, `_IMMUTABLE`, `_UNSUPPORTED` (not a stream repository), and by type `_LOCAL _CIFS _NFS _S3 _WASABI _B2 _AZURE _EC2 _GENERIC_S3 _DEDUP`; `NAKIVO_BK_IMMUTABLE_DAYS`.
- **Other-type backups (cross-hypervisor / cross-app cases):** `NAKIVO_BK_OTHER_BACKUP_REPO`, `_OTHER_HV_BACKUP`, `_OTHER_APP_BACKUP`.
- **Actions step:** `NAKIVO_BK_REPORT_EMAIL`, `NAKIVO_BK_PRE_SCRIPT`, `NAKIVO_BK_POST_SCRIPT` (script paths as the Director host sees them).
- **Streams (CPU/RAM calculation):** `NAKIVO_BK_STREAMS_CAP_<ITEM|DB|CPU|RAM_GB>`, `NAKIVO_BK_STREAMS_LOW_<ITEM|DB|CPU|RAM_GB>`, `NAKIVO_BK_TRANSPORTER_LOAD_LIMIT`.
- **License / tenant state (the owner sets the license; tests never change licensing):** `NAKIVO_BK_LICENSE_EXPIRY_DAYS`, `_EXPIRY_HOURS`, `_DB_REMAINING`, `_REMAINDER_1`, `_DB_1`, `_DB_2`, `NAKIVO_BK_TENANT_USERNAME`, `_TENANT_PASSWORD`.
- **Backup Copy states the specs cannot create safely:** `NAKIVO_BK_COPY_MISSING_BASE_DB`, `_COPY_BROKEN_LOG_DB`, `_COPY_EXPIRED_DB`, `_COPY_PENDING_REMOVAL_DB`, `_COPY_OFFLINE_JOB`, `_COPY_UNSUPPORTED_REPO`, `_COPY_TARGET_REPO_2`.
- **Tape:** `NAKIVO_BK_TAPE_LIBRARY`, `_TAPE_MEDIA_POOL`, `_TAPE_DRIVE`, `_TAPE_TARGET`, `_TAPE_MAX_DRIVES`, `_TAPE_DBS`, `_TAPE_SQL_BACKUP`, `_TAPE_NO_REPOSITORY`.
- **Safety gate:** `NAKIVO_BK_RECOVERY_CONFIRMED=yes` (NJM-191230, 191231 and the later steps of 178412 start a recovery through the Recover wizard, which was never explored; without the gate they end ABORTED so a default cannot overwrite a source database).

## Differences between the cases and the 11.2.1 UI (the specs assert the UI and record a `case-vs-ui` annotation)

- The wizard has **4 steps** (Source, Destination, Schedule, Options); the cases describe 6 or 7 (Retention, Actions, Data Transfer). Retention is the inline "Keep backups for"; scripts, reports, streams and bottleneck detection are on Options. The path "Jobs > Create > ..." is Data Protection > + > Backup for Database.
- Schedules are inline: no Create / Edit schedule dialog, no Schedule card, no Daily type or Enabled switch. A Figma or mockup comparison cannot be scripted (NJM-154840, 154844, 154853, 154855, 169536, 171111, 171465).
- Differential or Log with no earlier Full: the product runs a Full and the job succeeds (NJM-154716, 154718, 154858, 175281 agree); the older cases say it must fail with sql2 / sql3. No db0001 notification was seen.
- The Run dialog's SQL backup type defaults to Log after a Full run, which fails on a SIMPLE database; specs pick the type explicitly.
- "Different containers selected" is "Different backup repositories selected"; the link is "Advanced setup...". Retention is time-based, not a count of recovery points.
- Network acceleration and Backup encryption are mutually exclusive (NJM-171464 asks for both).
- The Backup Copy wizard was never opened: every Backup Copy and Tape locator is an unverified text guess (`pages/bkA8-copy-wizard.page.ts`, `pages/bkA7-tape.page.ts`, `pages/bkA5-*`).
- Spec contradictions found earlier still stand: Exe-0009 / 00010 (fail with sql2 vs run a Full and show db0001), Exe-0011 vs 0011-1, BKC-0001..0006 (skip vs fail), sql5 used for two conditions.

## Things to know before the first real run

- **Jobs that run every minute:** about 20 specs (SQL backup type / Backup Execution schedule cases, Step 3 Schedule cases) create a Periodic 1-minute job and wait for its automatic run. Their cleanup disables the job, lets a running run finish, then deletes it keeping the backups. If cleanup fails the job keeps running: after the first runs check Data Protection for leftover jobs named `NJM-<key>`.
- **Lab changes the specs make (and undo):** jobs named `NJM-<key>` (deleted in afterEach); recovery model changed to SIMPLE and restored (NJM-154717); table `dbo.QA_NJM154677` and `qa_bk_changes` created and dropped; database `NJM178362_new` created and dropped; native (external) SQL backups written to the instance's default backup folder (`NJM-154692..159776`); saved encryption passwords created and deleted.
- **NJM-154675** needs Full plus 50 Log runs (up to about an hour).
- **SqlBackupHost** (`helpers/sql-host.ts`) and the msdb reads were never run against a server.
- Cases that share a database or repository must run one at a time (single worker, as the project already runs).
