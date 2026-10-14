---
id: workflows.inventory.remove-mssql-item
topic: inventory-mssql-remove
source: Live Director UI, item page > Remove; remote host checks over WinRM during three real removals; dialog re-opened and cancelled on 2026-10-12
source_type: live-ui
product: nakivo-backup-replication
area: inventory
product_version: "11.2"
build: 11.2.1.112232
verified_on: 2026-10-12
how_verified: Removed an item three times, one per option, polling the Windows host about every 0.7 s; re-opened the dialog on an instance and an Always On AG on 2026-10-12 and cancelled it.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: draft
relates_to: [workflows.inventory.add-mssql-item, workflows.inventory.edit-mssql-item]
---

# Remove a Microsoft SQL Server item (current UI)

## Flow

Open the item, click the trash icon (**Remove**, `.icon-remove`; click the element, and retry if the first click right after the page loads is lost). The dialog **"Remove the host?"** says "This host will be removed from the inventory. Do you also want to remove the transporter installed on this host?" and offers three radio options plus **Cancel** and **Remove**. The same dialog appears for instance and Always On AG. The cases say only "Manage > Remove"; they do not mention the options.

## The three options

| Option | Inventory | Nodes list | Host |
|---|---|---|---|
| Remove host and keep transporter | item gone within about 1 s | node stays; type changes from "Physical machine agent" to "Transporter (Installed service)" | unchanged (`bhsvc` running, folder present, port 9446 open) |
| Remove host and transporter (no uninstall) | gone | node removed (seen within 18 s) | unchanged; software stays installed and running |
| Remove host and uninstall transporter | gone | node removed (within 18 s) | real uninstall: `bhsvc` stops at about 0.7 s, port closed about 4.5 s, folder deleted at about 15.7 s |

- Options 2 and 3 look identical in the UI; only the host shows the difference.
- For an Always On AG, options 2 and 3 remove the nodes of **every** host of the group.
- Child databases leave the Inventory with the item.
- Re-adding after option 2 is slower (about 41 s against about 21 s after option 1) because the agent service restarts.

## Not verified

- Whether Remove without choosing an option does anything (no option is visibly selected; the Remove button is shown, its enabled state was not recorded).
- Removing an item that jobs or policies depend on.
- Removal from a list context menu or by multi-select.
- Failed rows are not removed with this dialog: their "..." menu has **Cancel**, which deletes the item.
