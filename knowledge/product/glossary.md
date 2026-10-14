---
id: product.glossary
topic: product-terminology
source: Confluence space tst, page "Definitions" (page id 2064467, version 20, last edited 2021-06-29)
source_type: confluence
product: nakivo-backup-replication
area: cross-cutting
product_version: unknown
build: unknown
verified_on: 2026-10-01
how_verified: The page body was read in full on 2026-10-01 and eight terms were summarized in our own words. Not reconciled with the live UI.
confidence: medium
trust_tier: T3
nature: terminology
status: reviewed
relates_to: [ui.overview]
---

# Product glossary (unreconciled terminology)

> **Unreconciled terminology.** These definitions come from a single Confluence page last edited on 2021-06-29. They were not compared with the live Director, and the page does not say which product version it describes. Treat them as vocabulary, not as a description of current UI behavior.

The page describes itself as a list of definitions used throughout the product's requirements pages. This document keeps eight of them, paraphrased.

| Term | Meaning (paraphrased) |
|---|---|
| **Director** | A component of the product that provides the user interface and discovery, and carries the underlying product logic. |
| **Transporter** | The product component that carries out the actual processing and transfer of data. |
| **Job** | A task created in the product. It specifies the source objects it processes, the target locations, the schedule it runs on, and its options. |
| **Job run** | A single execution of a job, started either by its schedule or manually by a user. A run can end in success, in failure, or by being stopped. |
| **Backup** | Two senses, both from the page. As a noun: a copy of a source object that the product creates and stores in a backup repository in its own (proprietary) format, and from which it can be restored. As a verb ("back up"): the scheduled or on-demand activity of producing and maintaining that copy. |
| **Backup Repository** | Storage that the product has discovered and uses to keep backups. |
| **Recovery Point** | A state saved after a replica synchronization or an incremental backup, which allows a replica rollback or a backup restore to that specific point. |
| **Inventory** | The virtual infrastructure the product has discovered and stored, and shows in its UI. The page's examples are vCenters, standalone hosts and AWS accounts, together with the items beneath them. |

## Notes

- **Related terms on the same page, not recorded here:** source object, target object, replica, replication, job group, the recovery types, and others.
- **UI labels are not equated with these terms.** The Overview page shows the labels "Jobs" and "Repositories" (see `ui.overview`). The page does not state that those labels denote the Job and Backup Repository terms above, so no equivalence is assumed. The same applies to any other label that resembles a term.
- **"Director" as a UI label.** The page defines it as a product component. Whether the UI itself uses the word "Director" as a label has not been verified.

## Remaining uncertainty

- The page is about five years old and gives no product version.
- The page also defines a "controller" as a part of the Director. This glossary does not carry that forward, and its current relevance has not been checked.
- No term has been checked against a current specification or the live UI.
