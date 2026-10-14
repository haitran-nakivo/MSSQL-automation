# MSSQL Always On availability group: add, duplicate, edit (lifecycle)

Status: derived working material (workspace), 2026-10-05. Spec: `tests/inventory/mssql-availability-group-lifecycle.spec.ts` (serial, one shared browser session via the worker-scoped `inventorySession` fixture). Not yet in a reviewed knowledge document.

## Observed
- **Add:** as in `mssql-ag-add-learning.md`. Completion is the row's Details reading `<n> hosts, <n> databases` (observed: 2 hosts, 6 databases); the test does not assert the counts. Run time 3.6 min with 300 ms slow motion.
- **Duplicate (negative case #8):** with the item present, submitting the same host/AG again (different Display name) keeps the wizard open with the message `This Microsoft SQL Server is already added to the inventory as "AAG-10.10.38.76". Duplicate entries are not allowed. (DbDiscoveryException)`. The message names the existing item. The Inventory list is unchanged afterwards (same rows, original item still complete). Verified in the test run and again by a throwaway script.
- **Edit:** item page > Edit opens the same form as Add (Display name editable, Type disabled, host, OS and SQL fields prefilled, passwords hidden) with Cancel and Save. Only Display name is edited by the test (`AAG-<host>` to `AAG-<host>-edited`, then back); Save closes the dialog and the list shows the new name with no Failed state. The test does not re-enter passwords.

## Deviations and leftovers
- Locators are class/`name`/text based and unapproved (same as the Add test). The grid row locator uses `.x-grid-row`.
- `InventoryPage.item()` was narrowed to grid rows (the item name also appears as a second link elsewhere, which broke strict-mode clicks in an earlier run). The older positive spec uses it too.
- The test cannot remove the item (Remove confirmation unresolved): `AAG-10.10.38.76` stays in the Director's Inventory; a rerun of step 1 is rejected as a duplicate until it is removed by hand.
