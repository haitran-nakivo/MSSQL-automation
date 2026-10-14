# Add MSSQL Always On availability group to Inventory: negative cases

Status: derived working material (workspace), 2026-10-05. Evidence: live inspection of the Director in `.env` (`NAKIVO_BASE_URL`, v11.2.1.112232, English) with read-only throwaway scripts that never pressed Finish with a submittable form. Spec: `tests/inventory/add-mssql-availability-group-negative.spec.ts`. Not yet in a reviewed knowledge document.

## Observed validation (no item created)
- Empty form + Finish: the wizard stays open; Hostname or IP, OS username, Availability group name and SQL username get `aria-invalid="true"` (and the `x-form-invalid` class). Display name, OS password and SQL password stay valid (not required). No message text is shown for these fields.
- Hostname `bad host name` and `!!!` become invalid when the field loses focus; `999.999.999.999` and `10.10.38` do not (the form accepts them, so rejection could only come after submit).
- AG name: `bad ag name!!` and a single space are accepted by the form; a 300-character value is marked invalid (limit not determined).
- Duplicate host (from the earlier positive run, recorded in `mssql-ag-add-learning.md`): the wizard stays open with the message `This Microsoft SQL Server is already added to the inventory as "<name>". Duplicate entries are not allowed. (DbDiscoveryException)`.

## Cases automated
| Case | Precondition | Input | Expected | Cleanup |
|---|---|---|---|---|
| Empty form | signed in, wizard open on the AAG form | nothing | Finish blocked; 4 required fields invalid, 3 optional fields valid; Inventory unchanged | none |
| Missing Hostname / OS username / AG name / SQL username (4 cases) | same | all values from `.env` except one required field | Finish blocked; only that field invalid; Inventory unchanged | none |
| Invalid hostname `bad host name`, `!!!` (2 cases) | same | valid values, invalid host | host invalid, Finish blocked; Inventory unchanged | none |
| Duplicate host | an Inventory item for the target host exists | valid values, other Display name | wizard stays open with the duplicate message; Inventory unchanged | none (skipped when the precondition is not met) |

## Not automated, and why
- **Wrong OS or SQL credentials, wrong AG name, unreachable host, well-formed but invalid host (`999.999.999.999`):** the form accepts them, the wizard closes, and the Director adds an item that later shows Failed or Inaccessible with no message. Failed items stay listed and the Remove button gave no confirmation in earlier probes, so these cases would leave uncleanable items in the shared Director. With the target host already in Inventory they would presumably hit the duplicate rejection instead, which was not verified and would not test credentials.
- **Empty password:** passwords are not required; submitting would add an item.
- **Whitespace-only AG name, over-long values:** behavior beyond the client marker was not observed.
