# Assertion and wait policy

Status: **DRAFT for owner review.** Date: 2026-10-02. Part of `standards/README.md`.

## 1. Assertions

1. **Assertions belong in tests.** `expect` is used in `tests/`. It is not used in page objects, components or helpers.
2. **One narrow exception:** a fixture may check its **own contract** (see `fixtures-and-session.md`). Such a check is limited to what the fixture promises, for example that a signed-in fixture really ends signed in. It never checks the behavior a test is about.
3. **Assertions verify observable behavior**: what a user can see or the browser reports (visibility, text, state, URL). They do not verify implementation details such as generated ids or `x-*` classes.
4. **Web-first assertions** (`expect(locator)...`, `expect(page)...`) are used so that Playwright waits and retries. A value is not read and then compared by hand when a web-first assertion exists.
5. **An asserted expectation must be supported by existing knowledge or evidence.** Behavior that no reviewed knowledge document records is not asserted; it is reported as a knowledge follow-up and handled through the knowledge process. Xray case text is an origin, not evidence (see `naming-and-traceability.md`). Verified product facts are not changed to make an assertion easier.
6. A failure message must not contain a secret value.

## 2. What page objects expose

Page objects and components expose:

- **read-only `Locator` properties** for the elements a test checks (the test asserts on them);
- **state queries**, methods that return a value (a text, a count) and decide nothing;
- **action methods** that perform a user action.

They own no business assertion and no pass or fail decision. A method that returns the next page object does so only when the navigation is deterministic.

## 3. Waits

1. **No arbitrary waits.** `waitForTimeout` and any fixed sleep are not used. This matches the recorded finding that no explicit waits were needed (`ui.auth-session`, Waiting behavior).
2. Playwright's auto-waiting and web-first assertions provide the waiting.
3. A page object may offer a readiness method named `waitFor<State>` that waits for the screen's own observable state (for example the element that shows the screen has loaded) by Playwright's waiting mechanisms (for example `locator.waitFor()`, not `expect`, which section 1 keeps out of page objects). It synchronizes; it does not verify a business expectation, and the state it names is one the knowledge records.
4. Timeouts are set in `playwright.config.ts` only, and this step changes none.
5. A wait for something the knowledge does not record is not added. It is a knowledge follow-up.

## Step delay (owner exception, 2026-10-12)

`fixtures/index.ts` wraps `test.step` so every spec pauses `STEP_DELAY_MS` (2000 ms, in `fixtures/run-options.ts`) after each step that passes. It is a viewing delay for the video, applied in one place; specs and flows still add no fixed waits of their own. A failed step rethrows at once. The test timeout is extended by the same pause, so it never eats a spec's budget. New specs get this by importing `test` from `fixtures` (never from `@playwright/test`); do not add pauses of your own. The same pause (`helpers/viewing-pause.ts`, `viewingPause()`) runs after every wizard Next that moved, inside the shared flows (`BackupFlows.next`, `InventoryFlows.nextStep`, `ChainFlows.acceptRecoveryPoint`, the Recover and tape wizards); a new flow that clicks Next must call it, and a spec must not. Page objects never pause (`AddInventoryItemPage.next()` has none: use `InventoryFlows.nextStep()`). A negative case where Next must stay blocked passes `next({ blocked: true })`, which skips the pause. `test.setTimeout()` is wrapped in `fixtures/index.ts`, so a timeout set after some pauses still includes them.

## Lists load after the page (owner review, 2026-10-13)

The Inventory grid fills about 0.2 s after the tab opens (no loading mask; observed live). A read of "is X listed?" right after navigation can see an empty grid and report a false "absent": it caused a false ABORTED ("already in Inventory under another name") and the NJM-154364 Cancel-on-Edit failure.
`InventoryPage.goto()` therefore returns only after the first grid row is visible (`listLoaded()`), so `InventoryFlows.hasItem()` after `gotoInventory()` is safe. A decision that rests on "not listed" (a precondition, a cleanup) uses `InventoryFlows.isListedWhenLoaded()`. An Inventory with no items shows no row, so it costs the 15 s timeout once.
Removing an item, and the Nodes list, are checked by polling the observed state (`expect.poll` on the list or on Settings > Nodes), never by assuming that the click worked.

## Specs that call `addInventoryItemPage.next()` directly (owner review, 2026-10-13)

About 96 specs (Discovery Scope Step 1/2, the examples) click Next through the `addInventoryItemPage` fixture instead of `InventoryFlows.nextStep()`. The page's `next()` already waits for the Options step (the visible Hostname input), so the wait for the new screen is there; only the viewing pause was missing. `fixtures/index.ts` (`withNextPause`) wraps `next()` on the fixture's page object, in the test-scoped and the worker-scoped `inventorySession` fixture, so those specs pause after Next without being edited and the page object stays free of pauses. Flows build their own page object and use `nextStep()`, so nothing is paused twice. A new spec uses `inventoryFlows.nextStep()`.

## OS_Platform support/Discovery cases: shared lifecycle and cleanup (owner request, 2026-10-13)

The 29 cases of `tests/.../OS_Platform support/Discovery` share their bodies instead of copies: `helpers/instance-lifecycle.ts` (`InstanceLifecycle`, kinds `instance`, `fci`, `ag`, `readScale`; the spec keeps the Xray `test.step` list), `helpers/case-cleanup.ts` (`CaseCleanup`: start-clean guard, final-clean check, afterEach cleanup) and `helpers/remove-host-steps.ts` (`RemoveHostScenario`, `MemberHosts`).
- Start clean: a node in Settings > Nodes or a listener on port 9446 that the case did not create ends it ABORTED, untouched. Pre-existing lab items are never removed.
- The Remove step runs once per Remove option (uninstall, remove transporter, keep transporter), each from the clean state and back to it; the add-only and edit-only cases end with "uninstall transporter" cleanup.
- Cluster items: the member hosts are the nodes that appear in Settings > Nodes after the add; no member host or login is configured (UNVERIFIED that the members accept the item's OS login for the WinRM check).
- What cannot be cleaned is reported (`cleanup incomplete ...` error from a cleanup step, or a `cleanup-incomplete` annotation from afterEach), never ignored. `host-state` annotations record unverified transporter behavior (client-OS rejection cases).
