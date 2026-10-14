# Add Microsoft SQL Server Always On availability group to Inventory: what was learned

Status: derived working material (workspace), written 2026-10-02. Evidence: live inspection of Director NBR #2 (`10.10.19.133`, v11.2.1.112232, English) with throwaway scripts, plus Xray case NJM-154527 (steps only). Credentials and host values are in the gitignored `.env` only. **These findings are not yet in a reviewed knowledge document** (see "Deviations").

## Observed flow (NBR #2)
1. Sign in, open `/c/configuration` (Settings), click **Inventory** in the left tab list (it is `a` inside `div.tab-item.tabInventory`).
2. Inventory list: columns Inventory item, Item Type, Details. Toolbar: search, refresh (`title="Refresh All"`), **+** (`div.add-btn`, unnamed `button`), **...** (`div.more-horizontal-btn`; opens Credentials, Certificates, Network mappings, Re-IP rules, Scan servers).
3. **+** opens "Add Inventory Item". Step "1. Platform": tiles Virtual, SaaS, File Share, Physical, **Application**, Cloud Storage, Storage Devices. Choose Application, **Next**.
4. Step "2. Options" (the stepper then shows only Platform and Options). Type is a read-only combo whose default is "Microsoft SQL Server Always On availability group". Other choices: failover cluster instance, instance, Read-Scale availability group, Oracle database.
5. Always On fields (inputs located by `name`): Display name (`name`), Hostname or IP (`host`), OS username (`username`, first), OS password (`password`, first), AG name (`availabilityGroupName`), SQL username (`username`, second), SQL password (`password`, second). Username fields are combos ("Type or select username"). Standalone type shows "Instance name" instead of "AG name".
6. Empty Finish: wizard stays open; red borders on required fields (Hostname or IP, OS username, Instance name or AG name, SQL username).
7. **Finish**: the wizard closes at once. The list shows a row named after Display name (the host when Display name is empty) with type "Microsoft SQL Server Always On availability group" and Details "Adding..." plus a percentage.
8. Completion took about 80 s in the successful run; two earlier attempts showed "Failed" after about 40 s (cause not shown anywhere in the UI; one was a wrong username typed by the agent).
9. Final state: Details becomes "<n> hosts, <n> databases" (counts are not asserted). Selecting the row opens the item page: Display name, Type, Operating system, AG name, Total databases, SQL version, the databases, and a "No Issues" badge; buttons Refresh, Edit, Remove (trash icon).
10. **Duplicate add is rejected**: the wizard stays open and a message reads "This Microsoft SQL Server is already added to the inventory as "10.10.38.76". Duplicate entries are not allowed. (DbDiscoveryException)".

## Unresolved
- **Removal (cleanup):** the Remove button on the item page showed no dialog and removed nothing in four probes (role click, pixel click, with and without a native-dialog handler). It posts to `/c/router`. How removal is confirmed is unknown, so the test cannot clean up after itself.
- **Why two attempts failed** is unknown.

## Deviations from the project standards (recorded, not hidden)
- The locators below were verified by inspection and by the test getting through the wizard (strict mode), not through a reviewed knowledge document (`standards/locators.md` section 3): `.tabInventory` text, `.add-btn`, text "Application" / "Next" / "Add Inventory Item", `input[name=...]:visible`, `.first()` / `.last()` for the OS and SQL credential pairs, `getByText` for rows. Class, `name`-attribute and `.first()/.last()` locators are **not approved** by S4-5 and S4-4; they were used on the owner's instruction to automate this flow and need an owner decision or a knowledge update.
- The test lives in `tests/inventory/` (Inventory is outside the three approved areas) and sets a per-test timeout (the standards put timeouts in the config).
- The case is new coverage (P4-7) and changes the Director (S4-8b); both were instructed by the owner for this flow.

## Result of the automated test (2026-10-02)
- `tests/inventory/add-mssql-availability-group.spec.ts`: 1 passed (4.1 min) in headed Chrome with 2 s per action. Two screenshots are attached to the HTML report.
- Values are typed (click, key input, Tab); `fill()` led to failed adds, and the passwords showed blank in the form after a rejected duplicate.
- The Display name entered (`AAG-<host>`) is the item's name in the list and in the page header; the item page's "Display name" row shows the host.
- A completed add takes 1.5 to 4 minutes. A failed item stays in the list for a long time; the same host cannot be added twice.

## Failover cluster instance and the typing finding (2026-10-02)
- Failover cluster form: Display name, Type, Hostname or IP, OS username/password, **Instance name** (`name="instanceName"`), SQL username/password. Pick the type by clicking the read-only Type field and then the option text.
- **Typing finding:** at full speed the password fields lose characters (9 of 11 read back, in another attempt none). Adds made that way ended "Failed" after 20 to 40 s with no message. With `pressSequentially(..., { delay: 80 })` plus Tab all fields read back exactly (3 of 3 dry runs, nothing submitted), and both the AG and the failover cluster adds then passed.
- `AddInventoryItemPage.type()` uses the 80 ms delay for every field.
- A successful failover cluster item page shows General information (Display name shows the host, Type, Operating system), Instance details (Instance name, Total databases, SQL version) and the databases, with "No Issues".
