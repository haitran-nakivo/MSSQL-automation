---
id: workflows.inventory.edit-mssql-item
topic: inventory-mssql-edit
source: Live Director UI, item page > Edit (instance WS2022-SQL2022-16.176 and Always On AG AAG-36.6); Failed-row menu > Retry
source_type: live-ui
product: nakivo-backup-replication
area: inventory
product_version: "11.2"
build: 11.2.1.112232
verified_on: 2026-10-12
how_verified: Opened Edit on two healthy items, read every field state, used Cancel (with and without a change) and Close; Save was not clicked on these items. Save of a Display name change is confirmed by a passing Playwright spec on an item the test created.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: draft
relates_to: [workflows.inventory.add-mssql-item, ui.inventory.mssql-form-rules, ui.inventory.credentials-management]
---

# Edit a Microsoft SQL Server item (current UI)

## Flow

1. Open the item (click its name in **Settings > Inventory**), then **Edit** in the page header (next to Refresh and Remove). "Manage > Edit" in the cases is this button.
2. The wizard opens as **Edit: <display name>** with steps *1. Platform, 2. Options* and the buttons **Cancel** and **Save**.
3. Change values, then **Save**. A Failed row reaches the same form through its "..." menu > **Retry**; Save then re-runs the add ("Adding... 0%", then `<n> databases`, about 60 s observed).

## Form state on open (observed on an instance and an Always On AG)

| Field | State |
|---|---|
| Display name | editable, pre-filled |
| Type | **read-only and disabled** (cannot be changed) |
| Hostname or IP, name field (Instance name or AG name) | editable, pre-filled |
| OS username, SQL username | editable, pre-filled with the stored credential name |
| OS password, SQL password | editable, pre-filled with a **mask of 15 characters** (not the real password) |

Nothing is marked invalid on open. Field rules are the same inputs as in Add (`ui.inventory.mssql-form-rules`).

## Cancel

- **Cancel shows "Close the wizard?"** with a **Close** button, observed both with no change and after typing in Display name. **Close** discards the edit and returns to the item page; nothing is saved.

## Not verified

- Which validation errors Save shows for an emptied required field on Edit (only Add was probed).
- Whether Save of a changed host or credentials always re-runs discovery for a healthy item (confirmed only for a Failed item's Retry).
- Save with a new SQL password on a healthy item (the lab has one valid credential pair, so automated edits change the Display name).
