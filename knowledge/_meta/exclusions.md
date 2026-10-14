# Exclusions and security rules

Governance document. Created 2026-10-01. This is the single place for what must never enter `knowledge/`. Check it before ingesting anything.

## Never import

1. **Credentials and secrets**: passwords, tokens, API keys, `.env` values, private keys, and anything shaped like a login pair. This includes secrets found in Jira comments, Confluence pages, attachments, configuration files or repositories.
2. **Jira comment text from issues known to contain secrets.** NJM-189365 is a known example. Do not copy or quote its comments. A summary of those comments must not include hostnames, accounts or passwords.
3. **Lab details**: hostnames, IP addresses and account names beyond the minimum already recorded in `PROJECT_STATUS.md` and the source registry.
4. **Recordings, traces, videos and screenshots**: Playwright traces can contain typed values including passwords. Screenshots may contain user, lab or customer data.
5. **Attachments not reviewed**: for example the `.7z` archives of enriched test cases attached to Jira issues. Review before any use, and never store the archive itself.
6. **Raw source content**: no verbatim Jira, Confluence or other page text. Summarize in your own words and keep a pointer.
7. **Content from DEPRECATED or OLD pages, or pages from before 2020, as current requirements.** Such material can only be recorded as `historical`.
8. **The cached API specification as UI behavior.** It is T3 terminology only.
9. **The contents of the inaccessible GitHub repositories (`qaorch`, `nbr_automation`) as verified code knowledge.** Statements about them are T5 `unverified-claim` only.
10. **Anything about `qad.nakivo.com`.** It is the website-QA system, out of scope for this project.
11. **The wholesale NJM test-case corpus.** Only curated, selected cases are summarized.
12. **Placeholder or empty test cases** (for example "test case 001", "update").

## When you find a secret in a source

- Do not copy, quote or paraphrase it. Do not store it in any file or in this tree.
- Record only the fact that the source contains secrets (for example in `source-registry.md`) so others know to avoid it.
- Report it to the project owner.

## Before saving or committing any knowledge document

- Scan the text for password-like strings, tokens, key material, lab hostnames and IP addresses, and email addresses of private individuals.
- Check that no front matter field (`source`, `how_verified`) contains a secret or an access URL with an embedded token.
- Confirm the content is a summary, not a pasted excerpt.

## Not covered here

Credential handling for tests (`.env`) is defined in `PROJECT_STATUS.md`. `.env` is gitignored and its values are never recorded anywhere.
