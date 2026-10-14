---
id: ui.inventory.automation-notes
topic: inventory-automation
source: Playwright runs against the live Director while building flows/inventory.flows.ts, flows/wizard.flows.ts and the pages under pages/
source_type: project-code
product: nakivo-backup-replication
area: inventory
product_version: "11.2"
build: 11.2.1.112232
verified_on: 2026-10-12
how_verified: Each note was hit and resolved in a real run or a live inspection while writing the Inventory flows; the passing NJM-187289 run used them.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: draft
relates_to: [ui.locator-conventions, workflows.inventory.add-mssql-item, ui.inventory.mssql-form-rules]
---

# Inventory automation notes (Ext JS quirks)

- **Typing:** `fill()` does not reach Ext form values. Use `pressSequentially(value, { delay: 80 })` then `Tab`. Typing at full speed drops the first characters of a password (the add then ends Failed with no message). `aria-invalid` is set on blur, so Tab after typing.
- **Combos** (Type, username): open Type by clicking it, a username combo by clicking just right of the input; items are `.x-boundlist-item`, picked by exact text.
- **Rows and menus:** scope name matches to the `.x-grid-row` (the name can appear twice). The row "..." (`.more-horizontal-btn`) shows only on hover; click it with `force`, and retry because rows re-render.
- **Remove icon:** click `.icon-remove` as the element and retry until the dialog is visible.
- **Dialogs:** a stale hidden duplicate dialog stays in the DOM (use the visible one, `.last()`); Escape closes the whole Credentials dialog; the "Close the wizard?" heading is bold text, assert the detail text separately.
- **Waits:** "Adding... 0%" never progresses; wait for Details to match `\d+ databases?`. Do not wait for "Adding..." to disappear (it can pass before it appears). Fail fast on Failed, Inaccessible or the login page: a 10-minute wait outlived the session once. Use "Remember me" when signing in.
- **Hover texts:** diff the visible leaf texts before and after a real hover; tooltips need about 0.7 to 1.5 s.
- **Display names** are at most 25 characters. Owner format for items tests create: `AAG-`, `RSAG-` or `FCI-` plus the last two octets of the host IP (for example `AAG-38.76`), and `WS<year>-SQL<year>-<last two octets>` for a server instance (for example `WS2022-SQL2025-19.145`); `helpers/item-names.ts` builds them. Tests may touch only items they created; the lab existing items are never edited or removed.
- **Browser:** the Director certificate is not trusted (ignore HTTPS errors); `viewport: null` with a maximized window; headless gives a tiny window.
- **Lab fixtures:** adding a host that is already in Inventory ends with the duplicate message, so specs end ABORTED with a "remove it first" message instead of failing.
