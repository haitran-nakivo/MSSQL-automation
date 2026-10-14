---
id: ui.activities
topic: activities-screen
source: Live Director UI (lab instance recorded in PROJECT_STATUS.md), path /c/activities
source_type: live-ui
product: nakivo-backup-replication
area: cross-cutting
product_version: "11.3"
build: 11.3.0.112329
verified_on: 2026-10-01
how_verified: Observed read-only on the live Director (navigation, hovering a row, selecting and clearing one row checkbox, opening one details popup, using the activity search). Nothing was started, stopped, restarted, removed or configured. Only facts confirmed in the UI are recorded.
confidence: high
trust_tier: T1
nature: current-ui-behavior
status: reviewed
---

# Activities screen (current UI)

Facts about the Activities screen observed on the live UI. Activity names, dates and counts are lab data and are written here as placeholders or omitted.

## Access

- Activities is an item in the **left sidebar** and opens **`/c/activities`**.
- The page header reads **Activities**.

## Layout

- The page has two sections, **Running Activities** and **Past Activities**.
- Each section has the columns **Name**, **Status** and **Date**, and a select-all checkbox in the header row.
- Every row in the Past Activities list has a checkbox. No Running Activities rows were present, so rows of that list were not seen.
- When the Running Activities list is empty, it shows the text **"There are no running activities."** Its select-all checkbox is then **disabled**, with a `title` attribute of "There are no running activities."
- The select-all checkbox of the Past Activities list was enabled while past activities were listed.

## Past activity rows

- **Order:** newest first, by the date shown.
- **Name column:** an icon followed by the activity name, displayed as a link-style label. Three icons were seen, one for each of the name patterns below.
- **Name patterns observed:**
  - `Job run: "<job>"`
  - `Object recovery to "<name>" VM`
  - `Self-backup into repositories: "<repository>"`
- **Status column:** a colored badge with white text. Statuses observed:

  | Status | Badge color (computed) |
  |---|---|
  | Completed | green, `rgb(16, 204, 98)` |
  | Failed | red, `rgb(217, 28, 22)` |
  | Stopped | yellow, `rgb(204, 187, 10)` |

- **Date column:** weekday, day, month and time in the form `Thu, 01 Oct at 2:00`. Hours have no leading zero. For the activity whose popup was opened, the Date value equals the popup's Started value.
- **Row hover:** hovering a past activity row shows a **"…"** button at the right end of the row (checked on one row).

## Toolbar

- At the right of the page header are four controls shown as icons: **Search**, **Restart**, **Stop** and **Remove**.
- Restart, Stop and Remove carry `title` attributes with exactly those names.
- **Selection behavior observed:**
  - With nothing selected, Restart, Stop and Remove are all disabled.
  - With one Completed past activity selected, **Restart and Remove are enabled and Stop is disabled**.

## Search

- Clicking the Search icon shows a text input with the placeholder **"Search"** and an × button.
- Typing filters the Past Activities list without pressing Enter. Typing `Job run` left only rows whose names are `Job run: "<job>"` patterns.
- When nothing matches, the screen shows the text **"No matching activities found"**, and Restart, Stop and Remove are all disabled.

## Details popup

- Clicking an activity name opens a popup, and the page stays on `/c/activities`. The popup has a close (×) control.
- Inspected for **one Completed activity** of the `Self-backup into repositories: "<repository>"` pattern. It showed:
  - a title equal to the activity name, truncated with an ellipsis (the inspected name was long);
  - **Started:** a date and time;
  - **Status:** the status badge followed by a date and time;
  - **Initiated by:** a value (`Scheduled` for this activity);
  - two buttons, **Remove** and **Restart**.

## Not verified

Nothing about a running activity has been observed, because none existed: its row layout, status text, and the Stop control's behavior. Also not verified: the Skipped status, what Restart, Remove or the "…" button do, whether the popup shows other fields for other activity types or statuses, how select-all and multi-selection behave, what clearing a selection does to the toolbar, what the × button in the search input does, how the details popup is closed, how search matches (prefix, substring, case), and any limit on the number of results.
