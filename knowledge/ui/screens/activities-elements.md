---
id: ui.activities-elements
topic: activities-screen-elements
source: Live Director UI (lab instance recorded in PROJECT_STATUS.md), path /c/activities
source_type: live-ui
product: nakivo-backup-replication
area: cross-cutting
product_version: "11.3"
build: 11.3.0.112329
verified_on: 2026-10-01
how_verified: DOM inspection of the visible elements of the live Activities page (tags, attributes, classes and disabled states), plus a few click attempts, on 2026-10-01. No action button (Restart, Stop, Remove, the row "…" control) was clicked.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: reviewed
relates_to: [ui.activities, ui.locator-conventions]
---

# Activities screen: how the elements are exposed (current UI)

What a test or an inspection can see on the Activities screen. This complements `ui.activities` (what the screen shows and does) and `ui.locator-conventions` (general locator findings). These are observations, not locator recommendations. Activity names, dates and counts are lab data and are omitted.

## Page level

| Observation | How observed |
|---|---|
| No visible element on the page had a `data-testid` or an `aria-label` attribute. | DOM inspection of visible elements |
| Restart, Stop and Remove are not exposed as buttons. They are `div` elements with `role="presentation"`. | DOM inspection |
| The list contents are lab data. The observed list contained recurring entries with identical names and different dates, so a name alone does not identify one row. | Reading the list |

## Navigation item

| Observation | How observed |
|---|---|
| The sidebar Activities item has a `title` attribute "Activities". `getByTitle('Activities')` matched **two** elements, both on the Overview page and on the Activities page. The second match was not identified. | Element count; the first match was used to open the page |

## Toolbar

| Control | Exposure | Disabled state | How observed |
|---|---|---|---|
| Restart, Stop, Remove | `div` elements, `title` attributes "Restart", "Stop" and "Remove", `role="presentation"`, class `activityActionBarButton` | A CSS class `disabled` on the element. No `aria-disabled` attribute. | DOM inspection with nothing selected and with one past activity selected |
| Search | A `div` field container with class `activitySearchField` (the input appears inside it after clicking) and, at the same position, a `div.searchButton`. The icon has no `title`. | n/a | DOM inspection |

**Search input.** After clicking at the left of the `activitySearchField` box, an `input` with the placeholder "Search" is visible and focused. An earlier attempt using `locator('.searchButton').first().click()` did not open the input. The cause was not determined (the locator may match more than one element).

## Lists and rows

| Observation | How observed |
|---|---|
| Checkboxes are `input[type=checkbox]` elements. For 42 past rows there were 44 visible checkbox inputs: one per row plus one select-all per list. | Element count |
| The Running list's select-all had a real `disabled` attribute and `title="There are no running activities."`. The Past list's select-all had an empty `title` and no `disabled`. The two row checkboxes sampled had no `title`. | DOM inspection |
| A row's activity name is shown as the text of a `td` cell, and an element with a `title` attribute equal to the name exists for it. | DOM inspection |
| The status badge is a leaf element with class `status-style` whose text is the status (`Completed`, `Failed` or `Stopped`). | DOM inspection |
| Rows have a `td` cell with class `activity-manage` (seen on the first rows listed). After hovering a row, a `div` with classes `activityLivActionIcon activityLivRestartIcon jvabManage` was found at the right end of that row. It is displayed as "…", although one of its class names contains "Restart". Its function was not exercised. | Hover, then DOM inspection |
| Whether that `div` exists without hovering was not checked. | n/a |

## Details popup

| Observation | How observed |
|---|---|
| The popup container is a `div` whose classes include `activity-job-info-popup`. Its content is described in `ui.activities`. | Opened by clicking an activity name; DOM inspection |

## Not verified

- Whether any of these classes, titles or structures stays the same across builds or lab states.
- The elements of a running activity row, since none existed.
- Which element is the second match of `getByTitle('Activities')`, and whether `.searchButton` matches several elements.
- What the "…" control does.
- Accessible names of the toolbar controls beyond their `title`, and keyboard operation.
- Hidden elements: only visible elements were inspected.
