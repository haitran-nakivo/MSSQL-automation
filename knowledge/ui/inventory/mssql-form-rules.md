---
id: ui.inventory.mssql-form-rules
topic: inventory-mssql-form
source: Live Director UI, Add and Edit wizards (Options step) for the four Microsoft SQL Server types
source_type: live-ui
product: nakivo-backup-replication
area: inventory
product_version: "11.2"
build: 11.2.1.112232
verified_on: 2026-10-12
how_verified: Typed boundary values into every field of each wizard type and read aria-invalid and hover texts; hovered every info icon; AG-name limit re-checked on 2026-10-12. Finish was never clicked.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: draft
relates_to: [workflows.inventory.add-mssql-item, workflows.inventory.edit-mssql-item, ui.inventory.credentials-management]
---

# Add / Edit form: fields and validation (current UI)

Inputs are found by `name`: `name`, `type`, `host`, `username` (two: OS first, SQL second), `password` (two), and `availabilityGroupName` (Always On, Read-Scale) or `instanceName` (FCI, instance). All start empty in Add.

## Required and limits (after typing then Tab: red border and `aria-invalid="true"`; no inline message)

| Field | Required | Limit and characters |
|---|---|---|
| Display name | no | max 25 (26 is invalid; hover "The maximum length for this field is 25"). Spaces, tab, unicode and `<>` are accepted. |
| Type | yes (read-only combo) | disabled on Edit |
| Hostname or IP | yes | invalid for `bad host name`, `!!!`, and 253+ character values; `999.999.999.999` and `10.10.38` are accepted. |
| OS / SQL username | yes | 511 valid, 512 invalid. A space anywhere (leading, trailing, inner) is invalid. Empty shows "This field is required" on hover. |
| OS / SQL password | no | 511 valid, 512 invalid; empty is not flagged. Always masked, no eye toggle. |
| Instance name (FCI, instance) | yes | 255 valid, 256 invalid (cases say 511). `<>!@#`, inner and edge spaces are accepted. |
| AG name (Always On, Read-Scale) | yes | 255 valid, 256 invalid. `<>!@#` accepted. |

## Tooltips (info icon `div.qmMain`, text after about 0.7 to 1.5 s of real hover)

- Always On: host "Use the hostname or IP address of the Windows Server Failover Cluster (WSFC) that hosts the Always On Availability Group (AG)."; AG name "The Availability Group (AG) name which is configured in the SQL Server availability group settings."
- FCI: host "...of the Windows Server Failover Cluster (WSFC) that hosts the SQL Server Failover Cluster Instance (FCI)."; instance name "The SQL Server Failover Cluster Instance (FCI) name which is configured in the Windows Server Failover Cluster (WSFC)."
- Read-Scale: host "Use the hostname or IP address of the SQL Server that hosts the primary replica in the Read-Scale Availability Group (clusterless AG)."; AG name "The Availability Group (clusterless AG) name which is configured in the SQL Server availability group settings."
- **Instance type has no info icons.**

## Labels and links

"Display name:", "Type:", "Hostname or IP:", "OS username:", "OS password:", "Manage credentials" (under OS pair), "AG name:" or "Instance name:", "SQL username:", "SQL password:", "Manage credentials" (under SQL pair), buttons Cancel and Finish (Edit: Cancel and Save). Invalid marks persist when the Type is switched.

## Open differences from the specs

- The specs say both passwords are required (MSSQL-Inv-UI-Options-0023-5); the form does not flag them. Behavior at Finish is not verified.
- The specs give 511 as the instance and AG name limit; the UI limit is 255.
