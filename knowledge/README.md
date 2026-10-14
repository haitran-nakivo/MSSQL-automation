# Knowledge base

Governance document. Created 2026-10-01. Rules for this tree live here and in `_meta/`.

## Purpose

`knowledge/` holds curated, source-attributed knowledge about the **NAKIVO Backup & Replication** product, its UI, its workflows, its existing QA test cases, and the automation approaches used around it. Its job is to give test authors and AI agents facts they can trust, and to say how far each fact can be trusted.

It stores **summaries and pointers**, never raw copies of source content.

## Current state

Categories are created on the first real document in each, never earlier and never as empty placeholders. `_meta/changelog.md` records what exists.

## Stable structure

```
knowledge/
├── README.md     # this file
├── _meta/        # governance: schema, source registry, exclusions, vocabulary, changelog
├── product/      # concepts, terminology, domain objects
├── ui/           # navigation, controls, locators, auth/session, screens
├── workflows/    # purpose, preconditions, actions, expected outcomes, waits
├── qa/           # Xray structure, NJM metadata, scope, test-case summaries
├── automation/   # QA AI workflow, automation architecture
└── sources/      # content index: pointers into Jira, Confluence, etc.
```

The top-level categories never change. Product areas are data, not structure (see "Growth rules").

## Trust tiers

| Tier | Meaning |
|---|---|
| **T1** | Verified by us on the live Director, or taken from this project's own code |
| **T2** | Current specification, read and reconciled with the live UI |
| **T3** | Terminology or API vocabulary only; says nothing about UI behavior |
| **T4** | Jira/Xray test-case content; useful, but needs review before it is relied on |
| **T5** | Second-hand or unverified claims |

Material that must never be imported is listed in `_meta/exclusions.md`. It has no tier because it is not stored.

## Provenance rules

- Every knowledge document starts with a front-matter block containing the 12 required provenance fields defined in `_meta/provenance-schema.md`.
- Provenance is part of the document. A document without complete, valid provenance is not knowledge and must not be relied on.
- Links between documents use stable `id` values, not file paths.

## Nature rules

Each document has exactly one `nature`:

| Nature | Use for |
|---|---|
| `current-ui-behavior` | What the live UI does today (T1 only) |
| `intended-behavior` | What a spec or test case says it should do |
| `terminology` | Names and definitions of things |
| `historical` | Old, deprecated or superseded material kept for reference |
| `unverified-claim` | Second-hand statements we could not verify (T5 only) |

When a topic has several kinds of information, use one document per nature, share the same `topic` value, and link them with `relates_to`. Add the second document only when that second kind of information exists. If the live UI and a spec disagree, record both, and treat the UI as current behavior.

## Growth rules

1. **Areas are data.** Create `<category>/<product-area>/` only when real knowledge for that area is first ingested, and register the area in `_meta/vocabulary.md` in the same change.
2. **Cross-cutting vs area-specific.** General documents sit at the category root; area-specific ones go under `<category>/<area>/`.
   - **UI exception:** `ui/screens/` is an intentional, UI-specific convention for screen-specific documents (for example `ui/screens/login.md`). Other area-specific UI knowledge may use `ui/<area>/`. Other categories have no `screens/` equivalent.
3. **QA cases stay flat.** Test cases are `qa/cases/<KEY>.md`. Revisit partitioning only when the folder becomes hard to navigate (about 200 files is the planned review point), and then partition by a metadata field that already exists in the case front matter.
4. **Unverified material is marked by nature.** Second-hand automation claims are `unverified-claim`, T5, and open with a warning banner.
5. **Nothing is deleted silently.** Outdated documents become `stale` or `superseded` with a pointer to the replacement, and the change is logged in `_meta/changelog.md`.

## How to add knowledge

1. Check `_meta/source-registry.md`: is the source listed, and what is its tier and limit? If not, register it first.
2. Read `_meta/exclusions.md` and confirm nothing in the material is excluded.
3. Verify the information the way its tier requires (for T1, observe it on the live Director).
4. Write the document with full provenance. Summarize in your own words; do not paste raw source text.
5. Register any new area or controlled term in `_meta/vocabulary.md`.
6. Add an entry to `_meta/changelog.md`.
7. Update `PROJECT_STATUS.md`.
8. Have the new content reviewed before it is marked `reviewed`.

## Never

- Store credentials, tokens, passwords, lab secrets, recordings, traces or screenshots.
- Treat the cached API spec as UI behavior.
- Treat old, deprecated or pre-2020 Confluence pages as current requirements.
- Treat the inaccessible GitHub repositories as verified code knowledge.
