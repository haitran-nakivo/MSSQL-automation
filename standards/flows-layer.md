# The flows layer (`flows/`)

Status: **Created 2026-10-10 on the owner's approval** ("introduce a `flows/` layer and refactor only NJM-187289"). Part of `standards/README.md`. It adds a layer to `architecture.md`; every other rule there still applies.

## 1. Purpose

A flow is a reusable sequence of page actions that several test cases need, for example "add an Inventory item and wait for discovery" or "read the item page". Flows remove copy-paste between cases. They are not a framework: a case still owns its steps, its order, its expected results and every assertion.

## 2. Rules

| Rule | Detail |
|---|---|
| Position | `tests/` -> `fixtures/` -> `flows/` -> `pages/` -> `pages/components/`. A flow may import `pages/` and Playwright types only. Pages, fixtures and helpers may not import a flow, except that `fixtures/index.ts` creates the flow objects and hands them to tests. |
| No assertions | A flow never calls `expect`. It returns what it saw (a value, a record, an outcome such as `'added' \| 'duplicate' \| 'timeout'`, or a boolean) and the test decides whether that is right. A case that needs a value to settle polls the flow with `expect.poll` in the test. |
| No product decisions | A flow does not choose test data, read `.env` or credentials, or know an Xray key. Everything it needs is passed in. |
| Waits | Only `locator.waitFor` on observable UI state, with an explicit timeout. No fixed sleeps. |
| Failure | A flow returns an outcome for expected alternatives (a duplicate, a Failed row, a timeout). It throws only when an action cannot be performed. |
| Product state | A flow that adds, edits or removes an item changes product state. Using one in a case is governed by `fixtures-and-session.md` section 4 and decision S4-8b like any other test step, and the case decides whether to stop (ABORTED) or continue. |
| Naming | `flows/<area>.flows.ts`, one class per file, methods named for the user action (`startAdd`, `submitAdd`, `waitForDiscovery`, `readItemDetails`, `confirmRemove`). |
| Reuse test | A method belongs in a flow when at least two cases need the same sequence, or when it is an operation the first case plainly shares with the existing lifecycle specs. Case-specific order and checks stay in the case. |

## 3. What exists

`flows/inventory.flows.ts` (`InventoryFlows`): `gotoInventory`, `hasItem`, `openItem`, `startAdd`, `submitAdd`, `waitForDiscovery`, `readItemDetails`, `openEditForm`, `readEditForm`, `changeDisplayNameAndSave`, `openRemoveDialog`, `confirmRemove`, `removeIfPresent`, and the constants `ITEM_TYPES` and `REMOVE_OPTIONS` (only values verified on the Director). The first user is `the NJM-187289 spec in tests/DBs_Services_Apps product/.../OS_Platform support/Discovery`. The older lifecycle specs are unchanged and do not use it.
