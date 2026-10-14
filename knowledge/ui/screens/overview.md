---
id: ui.overview
topic: overview-screen
source: Live Director UI (lab instance recorded in PROJECT_STATUS.md), path /c/overview; corroborated by tests/nakivo-login-auth.spec.ts
source_type: live-ui
product: nakivo-backup-replication
area: cross-cutting
product_version: "11.3"
build: 11.3.0.112329
verified_on: 2026-10-01
how_verified: Page structure and text were inspected once on the live Director immediately after login. The landing URL and the Logout control are asserted by a passing Playwright test.
confidence: medium
trust_tier: T1
nature: current-ui-behavior
status: reviewed
relates_to: [ui.auth-session, ui.locator-conventions, ui.login]
---

# Overview screen (current UI)

The page the Director shows right after login. It was inspected once and only superficially, so confidence is **medium**.

- **Path:** `/c/overview`
- **Page title:** `NAKIVO Backup & Replication v11.3.0.112329` (the build number is part of the title)

## Left sidebar

Items read from the page, in order: **Overview**, **Data Protection**, **Data Security**, **Activities**, **Calendar**, **Search**, **Settings**, **Help**, **Logout**.

- **Overview** and **Logout** were inspected as elements. For each, the label text sits in a child `div` inside a parent `div` that carries a `title` attribute equal to its name and `role="presentation"`.
- The Overview item's parent carried an `active` class on this page. Classes are not used as locators.
- **Logout** is located with `getByTitle('Logout')`. The other items were read from page text only, and their destinations were not followed.
- The **Settings** item shows a small red numeric badge whose figure changes between visits (see `ui.overview-panels`). Its meaning was not investigated.

## Content areas seen

Layout and wording only; the figures shown are lab data and are deliberately not recorded.

- A license/trial notice and a **Contact Sales** button (the button has a `title` of the same name). Presumably this reflects the license state of this lab instance; that was not checked elsewhere.
- Labeled summary counters: **Issues**, **Jobs**, **Nodes**, **Repositories**, **Monitored items**, **Threats** and **Activities**. Their layout is described in `ui.overview-panels`.
- An **Activities** section whose text includes **Agenda**, a date range, a **Today** button (an actual button element), and **Date** and **Time** labels. Its structure was not inspected.
- Text consistent with a chart: the label **Speed (Mbit/s)** followed by numeric and date tick labels.
- A **Jobs** summary whose text lists **In Total**, **Failed**, **Stopped**, **Running**, **Not executed** and **Successful**.
- An **Events** table. Its text includes **Event name**, **Initiated by**, **Schedule** and **Date**. A search field and a filter button are identified by their `data-testid` values (see below).

## Locators on this page

- Among the visible elements inspected, `data-testid` attributes appeared only in the Events table: `event-table`, `event-table-header`, `event-table-header-search-field` and `event-table-header-filter-button` (see `ui.locator-conventions`).
- The page contains many generated ids (for example `simpleIcon-*` and `tableView-*`), which are not used as locators.

## Verified by test

`tests/nakivo-login-auth.spec.ts` asserts that after login the URL no longer matches `/c/login` and that `getByTitle('Logout')` is visible.

## Not verified

- What each navigation item opens.
- How the widgets behave (the Agenda, filters, search, chart).
- Whether the content depends on the user's role or permissions.
- Loading and refresh timing; no waits beyond Playwright's auto-waiting were needed to see the Logout control.
- Whether this layout is the same on other builds or with other data.
