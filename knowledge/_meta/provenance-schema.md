# Provenance schema

Governance document. Created 2026-10-01.

Every knowledge document begins with a YAML front-matter block with the 12 required fields below. Governance documents (`README.md` and everything in `_meta/`) are exempt.

## Required fields

| Field | Meaning | Allowed values |
|---|---|---|
| `source` | Exact locator of the information: URL, page id, Jira key or JQL filter. Never a secret or an access token. | free text |
| `source_type` | Kind of source | `live-ui`, `confluence`, `jira`, `xray`, `api-spec`, `repo`, `project-code`, `second-hand` |
| `product` | Product the information applies to | slug from `vocabulary.md` |
| `area` | Product area | a slug registered in `vocabulary.md`, or `cross-cutting` |
| `product_version` | Product version it applies to | e.g. `11.3`; `unknown` allowed |
| `build` | Exact build, if known | e.g. `11.3.0.112329`; `unknown` allowed |
| `verified_on` | Date the information was last verified | ISO date `YYYY-MM-DD`, not in the future |
| `how_verified` | How it was verified, in one sentence | free text |
| `confidence` | Confidence in the information | `high`, `medium`, `low`, `unverified` |
| `trust_tier` | Trust tier | `T1`, `T2`, `T3`, `T4`, `T5` |
| `nature` | Kind of information | `current-ui-behavior`, `intended-behavior`, `terminology`, `historical`, `unverified-claim` |
| `status` | Lifecycle state | `draft`, `reviewed`, `stale`, `superseded` |

## Optional fields

| Field | Meaning |
|---|---|
| `id` | Stable identifier, `<category>.<area>.<slug>` or `<category>.<slug>` for cross-cutting. Links use ids, not paths. |
| `topic` | Shared value tying together documents about one topic that differ by nature |
| `relates_to` | List of ids of related documents |
| `supersedes` | Id of the document this one replaces |

## Consistency rules

1. `source_type: api-spec` is valid only with `nature: terminology` and tier `T3`.
2. `nature: unverified-claim` is valid only with `trust_tier: T5`, and `trust_tier: T5` only with `unverified-claim`.
3. `nature: current-ui-behavior` is valid only with `trust_tier: T1`.
4. `nature: intended-behavior` is valid only with `T2` or `T4`.
5. A document built from a Confluence page marked DEPRECATED or OLD, or from a pre-2020 page, can only be `nature: historical`.
6. `source_type: second-hand` or `repo` (when the repository was not read by us) is valid only with `T5`.
7. `area` must be in `vocabulary.md`, or `cross-cutting`.
8. `confidence: high` requires `how_verified` to describe a direct observation or a reconciled comparison.
9. A document with `status: reviewed` must have complete, valid provenance and no excluded content.
10. A document with `status: superseded` must be named in another document's `supersedes`.
11. One document has one `nature` (see the README).

## Illustrative example

This block is an example of the format only. It is not a real knowledge document.

```yaml
id: product.example-term
source: <exact locator>
source_type: live-ui
product: nakivo-backup-replication
area: cross-cutting
product_version: "11.3"
build: unknown
verified_on: 2026-10-01
how_verified: Observed directly on the live Director.
confidence: medium
trust_tier: T1
nature: terminology
status: draft
```

Note that rule 3 is one-directional: `current-ui-behavior` requires `T1`, but a `T1` document may have another nature, such as `terminology` observed directly on the live UI.
