# MSSQL failover cluster instance: add, edit, delete (lifecycle)

Status: derived working material (workspace), 2026-10-06. Spec: `tests/inventory/mssql-failover-cluster-lifecycle.spec.ts` (serial, one shared browser session via `inventorySession`). The values come from the six `NAKIVO_MSSQL_FCI_*` variables in the gitignored `.env`. Not yet in a reviewed knowledge document.

## Observed
- **Precondition:** an `FCI-10.10.33.140` item created by the earlier Add-only test was still listed, degraded (96 issues, all 9 databases "(inaccessible)"). The Director rejects duplicates, so test 1 removes an item of that exact name first, with "Remove host and keep transporter".
- **Add (NJM-154526):** wizard closes, row appears, discovery completes with a database count and no Failed; item page shows the failover cluster type, the instance name and "No Issues". 1.4 min.
- **Edit:** same dialog as for the availability group; Display name `FCI-<host>` to `FCI-<host>-edited` and back; list and item page follow. 1.8 min.
- **Delete (keep transporter):** item removed, count -1, other items listed, Nodes list unchanged. 11.5 s.
- **Side effect seen:** after the Add, the nodes `10.10.33.140` and `10.10.33.139` are listed as "Transporter (Installed service)"; before, they were "Physical machine agent". Not asserted.

## Not covered
- Negative Add/Edit cases for the failover cluster, and the other two Remove choices (the AAG spec covers them for the availability group).
- Locators are the same unapproved class/`name`/text ones as the other Inventory tests.

## Left in the Director
The FCI item is removed (end of test 3). `AAG-10.10.38.76` stays in Inventory.
