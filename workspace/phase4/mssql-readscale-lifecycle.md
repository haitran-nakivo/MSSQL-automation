# MSSQL Read-Scale availability group: add, edit, delete (lifecycle)

Status: derived working material (workspace), 2026-10-07. Spec: `tests/inventory/mssql-readscale-lifecycle.spec.ts` (serial, one shared session via `inventorySession`). Values come from the six `NAKIVO_MSSQL_READSCALE_*` variables in the gitignored `.env`. No Xray key was given, so none is tagged. Display name `RSAG-<host>` is assumed. Not yet in a reviewed knowledge document.

## Observed
- Type "Microsoft SQL Server Read-Scale availability group" (fourth entry of the Type list). Its form has the same fields as the Always On availability group form (Display name, Hostname or IP, OS username/password, Availability group name, SQL username/password), so `fillAvailabilityGroup()` is reused. Empty Finish marks host, both usernames and AG name invalid.
- Add: discovery completed with a database count and no Failed; the item page shows the type, the AG name and "No Issues".
- Edit: Display name `RSAG-<host>` to `-edited` and back.
- Delete ("Remove host and keep transporter"): item removed, count -1, other items listed, Nodes list unchanged.

## Result (headless, 2026-10-07)
3 passed in 2.2 min: Add 1.2 min, Edit 39.7 s, Delete 11.4 s. Final state: the item is deleted; Inventory holds only `182.20.0.43`.

## Not covered
Negative cases, the other two Remove choices, and unapproved class/`name`/text locators, as for the other Inventory tests.
