# The tool layer (`tool/`)

Status: **Created 2026-10-09 on the owner's instruction** ("proceed with building the shared automation framework"). Part of `standards/README.md`.

## 1. Purpose and boundary

`tool/` lets a person enter an Xray Test Execution key, see its test cases, run one registered case at a time, and have the result and evidence reported to the individual Xray test run. It is **not** one of the five Playwright layers and is not a test: it starts tests, reads their result files and talks to Jira.

| Rule | Detail |
|---|---|
| No AI at run time | The tool and the specs it starts are plain code. No agent, LLM or model decides a step, an assertion or a result. An AI assistant may help write and review the code only. |
| One-way boundary | `tool/` never imports from `tests/`, `pages/`, `fixtures/` or `helpers/`, and those layers never import from `tool/`. They share only files and environment variables: the run folder (`QA_RUN_DIR`), the run settings (`QA_RUN_ID`, `QA_CASE_KEY`, `QA_EXECUTION_KEY`, `QA_BUILD`, `QA_FIX_VERSION`, `QA_TENANCY`) and the `status.json` written by `reporters/status.reporter.ts`. |
| Verdicts belong to the spec | PASS and FAIL come from the assertions in the spec and are written by the reporter. The tool only maps "no verdict could be produced" (pre-flight failed, timeout, no result file, a PASS that the exit code contradicts) to **ABORTED**. |
| Dependencies | None added. The tool uses Node's built-in `fetch`, `http`, `child_process` and TypeScript type stripping (`node tool/main.ts`, Node 24). Syntax must be erasable: no enums, namespaces or constructor parameter properties; relative imports carry the `.ts` extension. |

## 2. Amendment of the no-Jira rule

P4-9, `naming-and-traceability.md` §2.6 and `architecture.md` §5 item 7 forbid Jira write-back and any Jira call. That stays true for `tests/`, `pages/`, `pages/components/`, `fixtures/` and `helpers/`. **The tool layer is the one exception**, because reporting results to Xray is its purpose (owner instruction, 2026-10-09). The exception is limited to `tool/jira/` and `tool/publish/`; no other part of the tool talks to Jira.

## 3. Safeguards

1. **Reporting is opt-in per run.** The interface defaults to "run only". "Dry run" reads Jira and shows the comment and upload plan without writing. "Yes" asks for confirmation.
2. **Only registered cases run.** `tool/registry/implementations.ts` maps a case key to its spec. A case is registered only when its spec is tagged `@<KEY>`; the registry checks the file and the tag at startup and shows any problem. Excluded, planned and unknown cases have no Execute button.
3. **The scope is data.** `tool/registry/scope-rev2.json` records revision 2 of the Discovery Scope assessment (287 cases: 261 in scope in three readiness groups, 26 excluded with reasons) and the per-case scope line that goes into the Xray comment. It is not product knowledge and is not read by any test.
4. **A PASS never says more than was checked.** The comment carries the case's scope line (what was verified, what the current NBR UI does not show). Cases adjusted to the current UI say so.
5. **Evidence is never deleted.** Each run writes to a new folder `artifacts/evidence/<KEY>/<stamp>_<random>/` outside Playwright's `outputDir` (`artifacts/test-output`, which Playwright wipes). Playwright's raw files for a tool run (video, trace) go to `<run folder>/pw-output`, so a killed run keeps them. Nothing in the tool deletes or reuses a run folder (the self-test works only inside its own `artifacts/selftest/`).
6. **One run at a time.** Runs share lab hosts and the Director; a second request is refused.
7. **Credentials.** `JIRA_BASE_URL` and `JIRA_TOKEN` live in the gitignored `.env`. The token is sent only as a Bearer header, is removed from every error text, and is never logged, stored in a result file or returned by the interface. The interface listens on `127.0.0.1` only, checks the Host header and requires a custom header on every POST.
8. **State-changing cases keep their own rules.** Whether a spec may add or remove Inventory items is decided per spec under `fixtures-and-session.md` §4 and S4-8b; the tool does not widen it.

## 4. What is verified and what is not

The Jira core calls (issue, search, the tests-association field `customfield_10715`) were confirmed read-only on 2026-10-09. Every `/rest/raven/1.0/` call (test list, test run, run update, attachment) comes from Xray's public documentation and is **unverified on this Jira**; `tool/jira/xray-client.ts` lists them. The Director build is not compared with the entered Build (no verified way to read it); the result says so.
