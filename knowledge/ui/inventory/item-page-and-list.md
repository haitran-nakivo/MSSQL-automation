---
id: ui.inventory.item-page-and-list
topic: inventory-item-page
source: Live Director UI, Settings > Inventory list and the item pages of an instance, an FCI and an Always On AG
source_type: live-ui
product: nakivo-backup-replication
area: inventory
product_version: "11.2"
build: 11.2.1.112232
verified_on: 2026-10-09
how_verified: Dumped the visible elements and classes of the list and three item pages, opened the issues link of an inaccessible FCI, and hovered the database icons.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: draft
relates_to: [workflows.inventory.add-mssql-item, workflows.inventory.remove-mssql-item, ui.inventory.mssql-form-rules]
---

# Inventory list and item page (current UI)

## List (Settings > Inventory)

- Columns: **Inventory item** and **Item Type** (sortable), **Details** (not sortable), and a last link column. There is **no search box** on the list; the left menu "Search" is a global search.
- Rows are `.x-grid-row`; the Inventory and Nodes grids both stay in the DOM, so filter by visibility. Details text: `6 databases` (instance), `1 database`, `<n> hosts, <n> databases` (AG types), or `Inaccessible` for a lost FCI. A Failed row is greyed and cannot be opened.

## Item page

- Header: type icon (`iconDbHost24` instance, `iconDbCluster24` FCI, `iconDbAvailabilityGroup24` Always On AG), the title, the health badge, and buttons **Refresh** (`div.x-btn.refresh-icon`), **Edit**, **Remove**.
- **Health badge:** `div.link-button.simple-link` with `div.hmIcon` (`icon-good` = "No Issues"; `icon-notice red` = issues) and the `a.slActive` text "No Issues" or "<n> Issues". With issues, the page shows "<n> Issues require your attention" and one line per alarm (for example `The "FCI-33.140" Microsoft SQL Server failover cluster instance is inaccessible`, date and host).
- **General information:** *Display name:* (the value shown is the host or IP), *Type:*, *Operating system*. **Instance details:** *Instance name:* or *AG name:*, *Total databases:*, *SQL version:* (for example 17.0.1000.7). **No edition is shown anywhere** on the item page or in the Edit form.
- **Database list:** a tree on the item page (nothing to expand). Each row has `img.x-tree-icon.iconDbDatabase24` (32 x 32, background `db-icons.svg#database`) and the database name. Hovering an icon shows no tooltip. An Inaccessible FCI still lists its 9 databases.
- Left over from the cases that is not in the UI: "Details panel", "X Inaccessible" widget, row checkboxes.

## Not verified

- What clicking the issues badge does on a healthy item.
- The database list on a Read-Scale item page (assumed the same as the instance list).
