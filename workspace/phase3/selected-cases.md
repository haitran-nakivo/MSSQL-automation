# Phase 3: selected test cases (result of milestone 3.1)

Status: **APPROVED by the owner on 2026-10-02** (36 cases, unchanged). Derived working material, not knowledge. Produced by applying `selection-method.md` to a Jira snapshot taken on 2026-10-02. Only issue keys, titles and metadata values were read. No steps, expected results, comments or attachments were read, and no UI was explored.

Columns: **#** is the selection order; **Pass** is the round-robin pass in which the case was taken; **Steps** is the Xray "Steps Count"; **RS** and **AS** are the Regression scope and Automation scope values.

## Authentication

Pool: 51 eligible cases in 9 strata. Selected: 12.

| Stratum (in selection order) | Pool size |
|---|---|
| Two-factor authentication | 17 |
| Password reset | 12 |
| Default login screen | 6 |
| Browser compatibility messages | 4 |
| Product start screens UI (server is not ready) | 4 |
| Disabled Login | 3 |
| Incorrect credentials | 2 |
| Logout section | 2 |
| Remote tenant | 1 |

| # | Pass | Stratum | Key | Steps | RS | AS | Title |
|---|---|---|---|---|---|---|---|
| 1 | 1 | Two-factor authentication | NJM-98495 | 2 | Yes | Planned | Login page - Two-factor authentication - A-2FA-2: Enter verification code |
| 2 | 1 | Password reset | NJM-98483 | 5 | Yes | Planned | Login page - Password reset - E1: Email password reset |
| 3 | 1 | Default login screen | NJM-98472 | 9 | Yes | Planned | Login page - Default login screen - A1: Create User Account - PRG-2: Create User Account screen |
| 4 | 1 | Browser compatibility messages | NJM-98512 | 2 | Yes | Planned | Login page - Browser compatibility messages - I1-A: In case the web browser is not supported (credentials configured): |
| 5 | 1 | Product start screens UI (server is not ready) | NJM-98516 | 2 | Yes | Planned | Login page - Product start screens UI (server is not ready) - K1: The system is starting |
| 6 | 1 | Disabled Login | NJM-98491 | 2 | Yes | Planned | Login page - Disabled Login - J1: Disabled tenant screen |
| 7 | 1 | Incorrect credentials | NJM-98477 | 2 | Yes | Planned | Login page - Incorrect credentials - B1: Incorrect Credentials Provided |
| 8 | 1 | Logout section | NJM-104803 | 1 | Yes | Planned | Logout section - Profile |
| 9 | 1 | Remote tenant | NJM-98494 | 2 | Yes | Planned | Login page - Remote tenant |
| 10 | 2 | Two-factor authentication | NJM-98496 | 2 | Yes | Planned | Login page - Two-factor authentication - A-2FA-3: Verification options |
| 11 | 2 | Password reset | NJM-98479 | 4 | Yes | Planned | Login page - Password reset - D1: Password Reset |
| 12 | 2 | Default login screen | NJM-98473 | 6 | Yes | Planned | Login page - Default login screen - A2: Credentials are Configured |

## Activities

Pool: 45 eligible cases in 4 strata. Selected: 12.

| Stratum (in selection order) | Pool size |
|---|---|
| Type | 21 |
| Error handling | 11 |
| UI | 8 |
| General | 5 |

| # | Pass | Stratum | Key | Steps | RS | AS | Title |
|---|---|---|---|---|---|---|---|
| 1 | 1 | Type | NJM-103500 | 3 | Yes | Planned | Activities dashboard - Type - Self-backup |
| 2 | 1 | Error handling | NJM-103538 | 2 | Yes | Planned | Activities dashboard - Error handling - In case an item no longer exists (was removed from Inventory) and an Activity that contains this item is restarted - File Level Recovery |
| 3 | 1 | UI | NJM-103524 | 2 | Yes | Planned | Activities dashboard - UI - Activities List: Search button |
| 4 | 1 | General | NJM-103495 | 1 | Yes | Planned | Activities dashboard - General - Running State |
| 5 | 2 | Type | NJM-103501 | 3 | Yes | Planned | Activities dashboard - Type - Individual file download |
| 6 | 2 | Error handling | NJM-103529 | 1 | Yes | Planned | Activities dashboard - Error handling - In case an item no longer exists (was removed from Inventory) and an Activity that contains this item is restarted - Vmware |
| 7 | 2 | UI | NJM-103525 | 2 | Yes | Planned | Activities dashboard - UI - Activities list: Running Activities list |
| 8 | 2 | General | NJM-103496 | 1 | Yes | Planned | Activities dashboard - General - Completed State |
| 9 | 3 | Type | NJM-103502 | 3 | Yes | Planned | Activities dashboard - Type - Individual file recovery to source |
| 10 | 3 | Error handling | NJM-103530 | 1 | Yes | Planned | Activities dashboard - Error handling - In case an item no longer exists (was removed from Inventory) and an Activity that contains this item is restarted - Instance |
| 11 | 3 | UI | NJM-103526 | 2 | Yes | Planned | Activities dashboard - UI - Activities list: Past Activities list |
| 12 | 3 | General | NJM-103497 | 1 | Yes | Planned | Activities dashboard - General - Stopped State |

## Overview

Pool: 51 eligible cases in 12 strata. Selected: 12.

| Stratum (in selection order) | Pool size |
|---|---|
| Events widget | 11 |
| Agenda widget | 9 |
| Summary bar | 9 |
| Backup size widget | 3 |
| General | 3 |
| Speed widget | 3 |
| Total backup storage widget | 3 |
| Job statistic widget | 2 |
| Jobs widget | 2 |
| Node tasks widget | 2 |
| Nodes widget | 2 |
| Repositories widget | 2 |

| # | Pass | Stratum | Key | Steps | RS | AS | Title |
|---|---|---|---|---|---|---|---|
| 1 | 1 | Events widget | NJM-98644 | 1 | Yes | Planned | Overview dashboard - Events widget - Check Events widget with 100k-500k items |
| 2 | 1 | Agenda widget | NJM-98616 | 1 | Yes | Planned | Overview dashboard - Agenda widget - Check UI |
| 3 | 1 | Summary bar | NJM-98607 | 1 | Yes | Planned | Overview dashboard - Summary bar - Single tenant - Check 999+ issues alarms for jobs/nodes/repositories/monitored items/activities |
| 4 | 1 | Backup size widget | NJM-98635 | 1 | Yes | Planned | Overview dashboard - Backup size widget - Check UI |
| 5 | 1 | General | NJM-98655 | 1 | Yes | Planned | Overview dashboard - General - Permissions - In case the user does not have permission to use a functionality |
| 6 | 1 | Speed widget | NJM-98628 | 1 | Yes | Planned | Overview dashboard - Speed widget - Check UI |
| 7 | 1 | Total backup storage widget | NJM-98625 | 1 | Yes | Planned | Overview dashboard - Total backup storage widget  - TSW-1: Total backup storage widget |
| 8 | 1 | Job statistic widget | NJM-98631 | 1 | Yes | Planned | Overview dashboard - Job statistic widget - Check UI |
| 9 | 1 | Jobs widget | NJM-98638 | 1 | Yes | Planned | Overview dashboard - Jobs widget - Check UI |
| 10 | 1 | Node tasks widget | NJM-98633 | 1 | Yes | Planned | Overview dashboard - Node tasks widget - Check UI |
| 11 | 1 | Nodes widget | NJM-98642 | 1 | Yes | Planned | Overview dashboard - Nodes widget - Check UI |
| 12 | 1 | Repositories widget | NJM-98640 | 1 | Yes | Planned | Overview dashboard - Repositories widget - Check UI |

Total selected: **36** cases (12 per area).

## Observations about this selection

- Every selected case has Regression scope = Yes and Automation scope = Planned. These two fields therefore do not separate the cases from each other.
- Authentication: the pool is dominated by topics that the Phase 2 knowledge records only partly or not at all (two-factor authentication, password reset, disabled login, remote tenant, browser compatibility messages, product start screens, incorrect credentials). The pool has only two logout cases and no Remember me case with Product = Core. How well each selected case is supported by the knowledge is a question for milestone 3.4, not a selection criterion.
- Overview: the first pick of the Events widget stratum is NJM-98644 (a very large data volume case). It is selected by the tie-break rule, not by relevance, and is a known weakness of the key-ascending tie-break.
