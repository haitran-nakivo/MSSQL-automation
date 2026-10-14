---
id: workflows.inventory.add-mssql-item
topic: inventory-mssql-add
source: Live Director UI, Settings > Inventory > "+" (Add Inventory Item); project specs under tests/DBs_Services_Apps product/ and flows/inventory.flows.ts
source_type: live-ui
product: nakivo-backup-replication
area: inventory
product_version: "11.2"
build: 11.2.1.112232
verified_on: 2026-10-09
how_verified: Walked the Add wizard for all four Microsoft SQL Server types on the live Director; timings measured on real adds; confirmed by Playwright specs that passed on real runs.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: draft
relates_to: [ui.inventory.mssql-form-rules, ui.inventory.credentials-management, workflows.inventory.edit-mssql-item, workflows.inventory.remove-mssql-item]
---

# Add a Microsoft SQL Server item to Inventory (current UI)

## Flow

1. **Settings > Inventory** (not "Configuration > Inventory" as the Xray cases say) > the **+** button opens **Add Inventory Item**.
2. Step **1. Platform**: nine radio tiles, none checked at first; choose **Application** ("Oracle database, Microsoft SQL Server."), then **Next**. The Application tile is enabled on the licensed lab and shows no tooltip.
3. Step **2. Options** (the "Type" step exists only for other platforms). Choose **Type**; the list is ascending and the default is the first entry: *Always On availability group, failover cluster instance, instance, Read-Scale availability group, Oracle database*.
4. Fill the form (fields: `ui.inventory.mssql-form-rules`), then **Finish**. There is no Next/Apply on this step. **Cancel** asks "Close the wizard?" (button **Close**).

## Outcomes

| Outcome | What the UI does |
|---|---|
| Success | The wizard closes about 0.2 s after Finish, the row appears about 0.3 s later and shows "Adding... 0%". The percentage never moves. Completion is the Details text `<n> databases` (AG types: `<n> hosts, <n> databases`). Timing observed for an instance: about 61 s on a clean host (agent install and restart), about 21 s when the agent is already there. AG, FCI and Read-Scale took 1 to 5 minutes. |
| Duplicate host | The wizard **stays open** with `This Microsoft SQL Server is already added to the inventory as "<name>". Duplicate entries are not allowed.` No second item is created, even with a different Display name. |
| Wrong SQL credentials, unreachable host, unsupported OS | The row ends **Failed** (greyed, cannot be opened). Its row "..." menu has **Show error**, **Retry** (opens the Edit form) and **Cancel** (deletes the item). Example error for a wrong SQL password: "Provided SQL credentials are incorrect or have insufficient permissions to be used by the product." |
| Blocked by validation | Finish does nothing and the wizard stays open; invalid fields get `aria-invalid="true"`. No item is created. |

## Side effects

- Adding installs a transporter agent on the host: node type "Physical machine agent", folder `C:\Program Files\NAKIVO Backup & Replication`, services `nkv-install-runner` (transient) then `bhsvc`, port 9446. See `workflows.inventory.remove-mssql-item` for what Remove does to it.
- No entry appears in Activities for add or remove.

## Not verified

- Behavior on an unsupported SQL version (older than the product supports): not observed, no host available.
- Whether Finish with empty passwords is accepted for a host that needs one (the form itself does not mark passwords required).
- The Windows 10/11 "operating system not supported" message is quoted from a case, not observed.
