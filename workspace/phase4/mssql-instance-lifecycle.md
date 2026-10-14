# MSSQL standalone instance: add, edit, delete (lifecycle)

Status: derived working material (workspace), 2026-10-06. Spec: `tests/inventory/mssql-instance-lifecycle.spec.ts` (serial, one shared session via `inventorySession`). Values come from the six `NAKIVO_MSSQL_INSTANCE_*` variables in the gitignored `.env`. No Xray key was given, so none is tagged. Display name `SQL-<host>` is assumed. Not yet in a reviewed knowledge document.

## Observed
- Type list: Always On availability group, failover cluster instance, **instance** ("Microsoft SQL Server instance"), Read-Scale availability group, Oracle database.
- The instance form is the same as the failover cluster form (Display name, Hostname or IP, OS username/password, Instance name, SQL username/password). Empty Finish marks host, both usernames and Instance name invalid.
- Add: discovery completed with "6 databases"; item page shows type, instance name `mssqlserver` and "No Issues". The host gets a "Physical machine agent" node.
- Edit: Display name `SQL-<host>` to `-edited` and back, as for the other types.
- Delete ("Remove host and keep transporter"): item removed, count -1, other items listed, Nodes list unchanged. The same "Remove the host?" dialog and three choices appear.

## Found while verifying (headless)
- The Remove confirmation did not open when the trash icon was clicked right after the item page opened (this explains the earlier "no confirmation" probes). `InventoryItemPage.openRemoveDialog()` now repeats the click (up to 5 times, 3 s each) until the dialog shows.
- Headless windows are small; the shared session now uses a fixed 1600x900 viewport when the window is narrower than 1200 px.

## Result
First headless run: Add and Edit passed, Delete failed on the lost click. After the fix: the whole spec passed (1.3 min), run twice in effect (Delete alone, then the whole spec). Final state: the instance item is deleted.

## Not covered
Negative cases, the other two Remove choices, and unapproved class/`name`/text locators, as for the other Inventory tests.
