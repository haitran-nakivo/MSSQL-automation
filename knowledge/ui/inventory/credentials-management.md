---
id: ui.inventory.credentials-management
topic: inventory-credentials
source: Live Director UI, "Manage credentials" links in the Add/Edit wizard (Credentials Management dialog)
source_type: live-ui
product: nakivo-backup-replication
area: inventory
product_version: "11.2"
build: 11.2.1.112232
verified_on: 2026-10-09
how_verified: Created, edited and deleted test credentials; selected stored credentials in the username dropdowns and added an instance with them (6 databases discovered); re-opened the dialog on 2026-10-09 and read its columns.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: draft
relates_to: [ui.inventory.mssql-form-rules, workflows.inventory.add-mssql-item]
---

# Credentials Management (current UI)

- Both **Manage credentials** links (OS pair and SQL pair) open the **same shared store**: `.manage-credential-dialog`, title "Credentials Management", columns *Credentials* and *Description*, a search box, "+" Add Credentials, a row "..." menu (Edit, Delete), footer **Learn more** and **Close**. A credential created from either link appears at once in both username dropdowns. Duplicate usernames are allowed. Lab entries: `administrator`, `lab.local\administrator`, `sa`. Never edit or delete entries a test did not create.
- **Selecting a stored credential** in the username combo (open it with the arrow just right of the input, pick by exact text) fills the username, clears its invalid mark and **disables the empty password field**; the stored password is used. Clearing the username re-enables the password.
- **Typing the same username by hand does not match the store**: the password stays enabled and empty (a manual entry). Editing a selected username makes it manual again.
- Only **Password**-type credentials appear in the dropdowns (not Master password or Private Key).
- **Add Credentials form:** Type (Password default, Private Key, Master password), Username (Master password uses "Name"), Password with an eye toggle, Repeat the password, Description. Private Key adds a required read-only key field with Browse. Messages are hover text: empty username "This field is required"; mismatched repeat "Passwords do not match. Please re-enter the password."; the Add button is never disabled; an empty password is accepted.
- **Edit credential:** Type disabled; username, password (pre-filled 15-character mask) and description editable.
- **Delete credential:** confirmation "Delete the credential? This credential will be deleted." with Cancel and Delete.
- **Not verified:** what Delete does to items that use the credential; end-to-end reuse of one credential by two real items.
