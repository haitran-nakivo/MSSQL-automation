# Controlled vocabulary

Governance document. Created 2026-10-01. Holds only the terms needed to validate provenance. New terms are added in the same change as the first document that uses them.

## Fixed enumerations

These are defined in `provenance-schema.md`; they are repeated here only for lookup.

| Field | Values |
|---|---|
| `source_type` | `live-ui`, `confluence`, `jira`, `xray`, `api-spec`, `repo`, `project-code`, `second-hand` |
| `confidence` | `high`, `medium`, `low`, `unverified` |
| `trust_tier` | `T1`, `T2`, `T3`, `T4`, `T5` |
| `nature` | `current-ui-behavior`, `intended-behavior`, `terminology`, `historical`, `unverified-claim` |
| `status` | `draft`, `reviewed`, `stale`, `superseded` |

## Products

| Slug | Meaning |
|---|---|
| `nakivo-backup-replication` | NAKIVO Backup & Replication (Director web UI) |

## Product areas

| Slug | Meaning |
|---|---|
| `cross-cutting` | Reserved. For documents that apply to the whole product rather than one area. |
| `inventory` | Settings > Inventory: adding, editing and removing Inventory items (first area: Microsoft SQL Server types), the credentials store and the item page. |
| `backup` | Data Protection: the Backup for Database job wizard, running and managing jobs (first area: Microsoft SQL Server databases). |

No other areas are registered (`inventory` was added on 2026-10-12, `backup` on 2026-10-12). An area is added here, with a one-line meaning, only when real knowledge for it is first ingested.

## Formats

| Item | Format |
|---|---|
| Dates | ISO `YYYY-MM-DD` |
| Version | `<major>.<minor>`, e.g. `11.3`; `unknown` allowed |
| Build | full build string, e.g. `11.3.0.112329`; `unknown` allowed |
| Area / topic slugs | lowercase kebab-case |
| Document id | `<category>.<area>.<slug>`, or `<category>.<slug>` for cross-cutting |
