# MSSQL Always On availability group: Delete (Remove) cases

Status: derived working material (workspace), 2026-10-06. Spec: `tests/inventory/mssql-availability-group-lifecycle.spec.ts`, describe "remove". Evidence: live inspection on the Director in `.env` (v11.2.1.112232) and the passing run. Not yet in a reviewed knowledge document.

## Observed
- On the item page, clicking the trash icon as an element (`.icon-remove`) opens "Remove the host?" with: "This host will be removed from the inventory." and "Do you also want to remove the transporter installed on this host?", three choices, and Cancel / Remove. (A role/text click on "Remove" opened nothing in earlier probes.) Cancel leaves the item.
- Choices: "Remove host and keep transporter", "Remove host and transporter (no uninstall)", "Remove host and uninstall transporter".
- Settings > Nodes lists a machine agent per host of the item (here `10.10.38.76` and `10.10.38.77` for the "2 hosts" AG), plus unrelated nodes.
- **Keep transporter:** the item is removed; no node is removed.
- **No uninstall / uninstall:** the item is removed and the nodes of **every** host of the availability group are removed (not only the target host's); unrelated nodes stay. Adding the group again recreates both nodes.
- Whether "uninstall" really uninstalls the software on the host's OS cannot be seen from the UI; the test judges it by the Nodes list only, so it cannot distinguish "no uninstall" from "uninstall".

## Cases automated (each deletes, checks, then adds the group again so the next case has an item)
| Case | Checks | Result (8.6 min, headed) |
|---|---|---|
| Keep transporter | item gone, count -1, other items listed; Nodes list unchanged | passed |
| Remove, no uninstall | same; removed nodes include the target host and number exactly the item's host count; other nodes stay | passed |
| Remove and uninstall | same as the previous case | passed |

Each case ends with the Add flow (discovery completes, no Failed, item page "No Issues"), so the item is in Inventory afterwards.

## Corrected on the way
The first version assumed only the target host's node is removed; the second case failed because the other host's node (`10.10.38.77`) was removed too. The assertion now uses the host count shown in the item's row.
