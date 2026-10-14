# Automation tool

A small local page to run an implemented test case with Playwright and look at the result, video and screenshots. The test is plain code: no AI takes part while it runs. Nothing is sent to Jira or Xray from the page. The rules of this layer are in `standards/tool-layer.md`.

## Start it

From the repository root:

```
npm run tool            # in Command Prompt or Git Bash
npm.cmd run tool        # in PowerShell (PowerShell blocks npm.ps1)
```

Then open http://127.0.0.1:4510 in a browser. Stop it with Ctrl+C.

Needed in `.env` (already used by the specs): `NAKIVO_BASE_URL` and the case's own variables (the page shows any that are missing). `JIRA_BASE_URL` and `JIRA_TOKEN` are needed only for the optional "read a Test Execution" section.

## Use it

1. Under **Cases you can run**, click **Run** on a case (today: `NJM-187289`). Build, Fix Version and Tenancy are optional and are only recorded. Untick "Show the browser" to run headless.
2. Wait. The browser window opens on this computer and the page shows the live log.
3. **Result** shows PASS, FAIL or ABORTED, the duration, the failed step and reason if any, every step, the video, the screenshots, and **Open evidence folder**.
4. **Earlier runs** lists every run of the case; select one to see it again.

PASS and FAIL come from the assertions in the spec. ABORTED means no verdict was possible: a missing `.env` variable, the Director not answering, no single test carrying the tag, a timeout, or no result file.

## Where things are saved

Every run gets a new folder, never reused and never deleted by the tool:

```
artifacts/evidence/<KEY>/<yyyymmdd-hhmmss>_<id>/
  result.json  status.json  <KEY>_<STATUS>_<time>.webm  evidence-*.png  run.log
  html-report/   pw-output/   (Playwright's raw video and trace for this run)
```

Runs started another way (`npm run test:njm-187289`, the editor) write `artifacts/evidence/<KEY>/<yyyymmdd-hhmmss>_<STATUS>/` with `status.json`, the video and screenshots; the page lists those too. `artifacts/test-output` is Playwright's scratch folder and is wiped at the start of a Playwright run, so keep nothing there.

## Check the tool itself (no browser, no NAKIVO, no Jira)

```
npm run tool:selftest   # runs against a local mock of Jira/Xray
```

## How a run works

1. `tool/registry/` resolves the case; only implemented cases can run.
2. `tool/preflight/` checks the `.env` variables and that the Director answers.
3. The runner checks, with `playwright test --list` (no browser), that exactly one test carries the tag `@<KEY>`.
4. The runner starts `playwright test <spec> --grep @<KEY> --output <run folder>/pw-output` as a child process.
5. The reporter (`reporters/status.reporter.ts`) writes `status.json`, the video and the screenshots into the run folder.
6. The runner reads `status.json`; with none, or a PASS that the exit code contradicts, the result is ABORTED.

## Adding a case

1. Write the spec under `tests/` and tag exactly one test `@NJM-<n>`.
2. Add one entry to `tool/registry/implementations.ts` (title, spec path, timeout, required variables, scope line).
3. Restart the tool: the registry checks the spec file and the tag.

## Not built yet

Reporting to Xray from the page (the code exists in `tool/publish/` and is untested against a real run), Build detection, Tenancy choosing a Director, lab-health checks, and every case other than NJM-187289.
