---
id: workflows.backup.backup-job-wizard
topic: backup-for-database-job
source: Live Director UI exploration on 2026-10-07 and 2026-10-08 (jobs created, run, edited and deleted); the Atomic Spec section 2 Backup Scope (page 169877684, v136)
source_type: live-ui
product: nakivo-backup-replication
area: backup
product_version: "11.2"
build: 11.2.1.112232
verified_on: 2026-10-08
how_verified: Created and ran jobs through the wizard on Director 10.10.19.133 (standalone instance, AG, Read-Scale AG items; Onboard and an Azure repository), watched Activities and the job page, and checked msdb.backupset on the SQL hosts. Not re-checked on 2026-10-12 (no live access was allowed that day).
confidence: medium
trust_tier: T1
nature: current-ui-behavior
status: draft
relates_to: [workflows.inventory.add-mssql-item, ui.inventory.automation-notes]
---

# Backup for Database job (wizard, run, manage)

**Where:** Data Protection (route `/c/main`) > `+` > Backup Job > **Backup for Database** opens "New Backup Job Wizard for Database". The Edit wizard (`/c/jobEditor?action=EDIT...`, title "Edit: <job>") has the same 4 steps and Save / Save & Run.

**The wizard has 4 steps in 11.2.1** (the specification lists up to 7: Retention, Actions and Data Transfer are not separate steps here).
1. **Source:** a tree of Inventory items with their databases (no tempdb). Ticking an item ticks all its databases and says "N item(s) were added to this job. New items created on or moved to the source host will be automatically added to this job." Next needs at least one source.
2. **Destination:** a combo, defaulting to "Onboard repository" only while it is the single repository; with two or more it shows "Select a target destination". "Advanced setup" gives each database its own destination and "Use an existing backup as a target".
3. **Schedule:** "Do not schedule, run on demand" hides the whole section. Otherwise Type (Weekly, Monthly, Yearly, Periodic, After another job), days, start / end time, Effective from, "Keep backups for" (retention, inline) and **SQL backup type** Full / Differential / Log (default Full).
4. **Options:** Job name, Job priority 1 to 5, Network acceleration / Network encryption / Backup encryption (Disabled / Enabled; backup encryption disables network acceleration), reports, pre / post job scripts, "Limit data backup to N concurrent streams" (default 1), Bottleneck detection. Buttons Finish and Finish & Run.

**Run:** "Finish & Run" opens "Run this job?" (scope: all or selected databases; schedule or "Keep recovery points for N days"; after a Full run exists, an SQL backup type combo that defaults to Log). The job page shows "Running (...)" then "Last run was successful" or "Last run has failed". Runs took 20 to 70 s. While a re-run is Running the old status text stays, so the end of a run is "no Running ( text".

**Results seen:** Full and Differential pass for every recovery model; Log passes for FULL and BULK_LOGGED; Log on a SIMPLE database fails with "Transaction log backups are not supported for databases using the SIMPLE recovery model". Differential or Log with no earlier Full runs a Full instead (no db0001 notification was seen). An external native Full or Log backup makes the next run create a new Full and show warning sql4. master supports Full only (Differential and Log are skipped with a message). SQL Server refuses SIMPLE or BULK_LOGGED on an AG database, so those combinations cannot be set up.

**Manage menu:** Clone, Merge, Rename, Create Report, Disable / Enable, Delete. Delete of a never-run job asks once; with runs it asks keep or delete the backups and, for delete, a second "Permanently delete the backups?" confirmation. Duplicate job names are accepted.

**Automation:** see `pages/backup-wizard.page.ts`, `pages/backup-job.page.ts` and `flows/backup.flows.ts`. Their locators come from this exploration and are not yet re-verified.
