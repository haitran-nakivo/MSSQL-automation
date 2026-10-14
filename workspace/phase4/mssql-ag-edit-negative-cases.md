# MSSQL Always On availability group: Edit negative cases

Status: derived working material (workspace), 2026-10-05. Spec: `tests/inventory/mssql-availability-group-lifecycle.spec.ts`, describe "edit negative cases". Evidence: read-only probes on the existing `AAG-10.10.38.76` item (nothing was saved) and the passing run. Not yet in a reviewed knowledge document.

## Observed in the Edit dialog
- Initially no field is marked invalid (`aria-invalid="false"` on all seven). Values are prefilled; both passwords are prefilled (hidden).
- Clearing Hostname or IP, OS username, AG name or SQL username marks only that field `aria-invalid="true"`. Clearing Display name or either password marks nothing.
- Hostname `bad host name` and `!!!` mark the host invalid.
- Cancel after a change opens a prompt: **"Close the wizard?"** with the text **"All changes will be lost."** and a **Close** button. Pressing Close closes the dialog; the item keeps its name. The Director shows no message text for the invalid fields, only the marker.

## Cases automated (all end without saving a change)
| Case | Expected | Result |
|---|---|---|
| Clear Hostname or IP / OS username / AG name / SQL username, then Save (4 cases) | field invalid, Save blocked, dialog open; reopening Edit shows the original value | passed |
| Host `bad host name` / `!!!`, then Save (2 cases) | host invalid, Save blocked, dialog open; reopened value unchanged | passed |
| Change Display name, Cancel, Close | prompt shown; dialog closes; old name stays, changed name not listed | passed |

Each case first asserts that no field is invalid before it changes anything, so the invalid marker is caused by the case.

## Not automated, and why
- **Wrong OS/SQL credentials, wrong AG name, wrong or unreachable host, then Save:** the form accepts them; Save would change the real item and may leave it Failed. Remove is not automated.
- **Empty Display name, empty password, no-change Save, Display name equal to another item:** the form does not mark them invalid, so Save may be accepted and would change or re-scan the real item; the outcome was not observed.
