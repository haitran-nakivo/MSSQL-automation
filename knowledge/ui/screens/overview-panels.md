---
id: ui.overview-panels
topic: overview-screen-panels
source: Live Director UI (lab instance recorded in PROJECT_STATUS.md), path /c/overview
source_type: live-ui
product: nakivo-backup-replication
area: cross-cutting
product_version: "11.3"
build: 11.3.0.112329
verified_on: 2026-10-01
how_verified: Read from the page text captured after sign-in and from screenshots of the Overview page (viewport 1600 by 1000) and of the Activities page sidebar, all taken on 2026-10-01. No control in the Overview content area was clicked; the Overview screenshot was taken with the sidebar Logout menu open.
confidence: medium
trust_tier: T1
nature: current-ui-behavior
status: reviewed
relates_to: [ui.overview]
---

# Overview screen: panels and controls (current UI)

Details of the Overview screen that `ui.overview` does not record. It extends that document and does not repeat it. Confidence is **medium**: the evidence is page text and screenshots at one viewport size. Counter values, dates, times and other lab data are omitted.

## Structure at a 1600 by 1000 viewport

Top to bottom:

1. One or more banners (see below).
2. A row of summary counters.
3. A two-column area: an **Agenda** panel on the left, and the **Speed (Mbit/s)** and **Jobs** panels stacked on the right.
4. Further panels below the first screen. The headings **Job statistic** and **Repositories** were seen at the bottom edge, and the Events table described in `ui.overview` is also on the page. Their order and contents were not examined.

The page extends below the first screen.

## Banners

| Observation | Evidence |
|---|---|
| A license/trial notice with a **Contact Sales** button is at the top (see `ui.overview`). | Page text, screenshot |
| In a later observation a blue banner reading "The new version <build> is available" appeared below it, with **Dismiss** and **Update...** buttons. It was not in the page text of an earlier observation, so the banner area is not constant, and a banner pushes the content below it down. The buttons were not clicked. | Screenshot compared with earlier page text |

## Summary counters

| Observation | Evidence |
|---|---|
| Seven counters, each a figure above a label: **Issues**, **Jobs**, **Nodes**, **Repositories**, **Monitored items**, **Threats** and **Activities**. | Page text, screenshot |
| The **Jobs** and **Nodes** counters carried small red badges with figures next to the main figure. The meaning of the badges was not examined. | Page text, screenshot |

## Agenda panel

| Observation | Evidence |
|---|---|
| Heading **Agenda**, a date-range label with previous and next arrows, and a **Today** button. The range shown was a Monday-to-Sunday week that contained the observation date. | Screenshot, page text |
| A table with the columns **Date**, **Time** and **Activities**, and a time-zone chip next to **Time**. | Screenshot, page text |
| The rows seen were for the days after the observation date, each with `Self-backup` as the activity. | Page text |

## Speed (Mbit/s) panel

| Observation | Evidence |
|---|---|
| Heading **Speed (Mbit/s)** over a chart with numeric ticks on the vertical axis and one date tick per day on the horizontal axis. The ticks seen covered seven days ending on the observation date. | Screenshot, page text |

## Jobs panel

| Observation | Evidence |
|---|---|
| Heading **Jobs**, with a donut chart that shows the total in its center under the label "In Total". | Screenshot, page text |
| A legend of five categories, each with a figure above its label and a colored dot: **Failed** (red), **Stopped** (yellow), **Running** (blue), **Not executed** (dark blue) and **Successful** (green). | Screenshot |

## Sidebar

| Observation | Evidence |
|---|---|
| The **Settings** item in the left sidebar shows a small red badge with a figure. The figure differed between observations (5 in some, 6 in another), so it changes between visits. Its meaning was not examined. | Page text and screenshots from different observations |
| The **Data Security** item shows a chevron. The item was not clicked. | Screenshot |

## Not verified

- What the previous and next arrows, **Today**, the legend items, the counters and the badges do when used.
- The meaning of the badges on **Jobs**, **Nodes** and **Settings**.
- The **Dismiss** and **Update...** buttons (not clicked), and what makes the new-version banner appear.
- The contents and order of the panels below the first screen, and the layout at other viewport sizes.
- What determines the values shown in any panel.
