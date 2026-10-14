# Phase 3: case inventory (milestone 3.2)

Status: **APPROVED by the owner on 2026-10-02** (36 cases and all findings and flags kept unchanged). Date: 2026-10-02. Derived working material in `workspace/`, not part of the knowledge layer.

The inventory covers the 36 cases of the approved selection (`selected-cases.md`), unchanged. For each case it records what the steps and expected results say, in paraphrase. It does **not** judge the cases against the Phase 2 knowledge; that is milestone 3.4.

**Read:** the title, description, manual steps (action, data, expected result), pre-condition association, labels, status, update date and issue links of each case. **Not read:** comments, attachments, the QA AI enriched archives. Wiki links in the step text (including an internal address) are not recorded. No credentials or lab values appear in these cases.

## Flags

| Flag | Meaning |
|---|---|
| **G** | The expected result is only a generic localization sentence (the UI is shown in the installer's selected language, nothing breaks, text truncates reasonably), sometimes followed only by a link to a spec section. There is no functional expectation. |
| **L** | Subset of G: the only addition is a spec link. |
| **E** | The expected result is empty. |
| **S** | The step's action field holds a requirement, a condition or a message text instead of an action (or the action and expected result appear swapped). |
| **U** | The case or its steps refer to a feature marked "to be implemented" or "to be deprecated" in a ticket. |
| **M** | Mismatched, stray or duplicated content. |
| **D** | The case needs a specific state, data or environment that it does not record. |
| **X** | Running it has a side effect or risk (data change, lockout, restart). |

## Facts that hold for all 36 cases

- Every case has the label **Localization**, status **Open**, Product **Core**, Regression scope **Yes** and Automation scope **Planned**. Updates range from 2026-05-28 to 2026-08-28.
- **No case has a pre-condition** attached, and **no step has test data**.
- The description of every case is only a link to a spec section.
- 24 cases have one or more linked "Defect" issues (Authentication 9, Activities 10, Overview 5); their statuses were not examined.
- The step count in Jira matches the steps found for every case.

## Authentication (12 cases)

| Key | Stratum | Steps | Purpose and flow | Expected-result summary | Dependencies, ambiguities, weaknesses | Flags |
|---|---|---|---|---|---|---|
| NJM-98472 | Default login screen | 9 | One check per control of the Create User Account screen of product registration: first name, last name, phone, username, business email, password, Remember me, Create account button, footer. | Mostly the generic localization sentence; plus rules for username (required), password (required, masked, show/hide toggle), Remember me (deselected by default), and the button (verifies email, creates the default user, logs the user in). | Needs a fresh, unregistered product. The description says some fields are not implemented and those steps should be aborted; four steps and one expected result cite open tickets. Creates a user account. | U D X |
| NJM-98473 | Default login screen | 6 | Checks the login screen when credentials are configured: username field, password field, Remember me, "Forgot password" link, Log In button, footer. | Username accepts "@", has focus on open, is empty, shows a placeholder; password is empty with a placeholder; Remember me unchecked; the link opens the reset screen; Log In is disabled while Username is empty and, on correct credentials, leads to one of several screens depending on wizard, tenant and 2FA state. | One expected result holds several branches (2FA enabled, configured or not). No test account or data named. One expectation is marked as to be implemented. | U D |
| NJM-98477 | Incorrect credentials | 2 | Describes the screen for a wrong username or password; step 1's action is the condition itself. | Warning "Incorrect credentials.", both fields highlighted, failed attempts counted per client address; five in a row within five minutes leads to a lockout screen. | The action is not an action. Needs repeated failed logins over a time window. | S D X |
| NJM-98479 | Password reset | 4 | Password reset first screen: username-or-email input, "forgot username and email" link, Done button, footer. | Placeholder text; the link opens the contact-administrator screen; Done is disabled for an invalid value and evaluates the value as a username or an email. | Does not say what makes a value valid or what happens after Done. | D |
| NJM-98483 | Password reset | 5 | Email reset screen: info text, input for the emailed security string, "did not receive a message" link, Done button, footer. | Info text about the emailed string; input accepts 1 to 25 characters; the link leads to a local-reset screen for an admin and to a contact-administrator screen for others; Done is disabled for invalid input. | Needs working email delivery and a role-dependent user; mentions single-tenant and multi-tenant roles. | D |
| NJM-98491 | Disabled Login | 2 | Screen shown to a tenant-level user whose tenant is disabled. | A warning that the service is disabled with a contact-your-administrator line; contact information shown only if configured. | Needs a multi-tenant product with a disabled tenant; the warning text has bracketed placeholders. | D |
| NJM-98494 | Remote tenant | 2 | Logging in to a service provider's instance with remote-tenant credentials; the action is the condition. | "Access denied.", both fields highlighted, failed attempts counted as above. | Needs a multi-tenant setup with a remote tenant; the action is not an action; shares the lockout counter. | S D X |
| NJM-98495 | Two-factor authentication | 2 | Checks the verification-code screen of two-factor login. | Info text varies with the default method (authenticator app or email) and with the chosen option. | Needs a user with 2FA enabled and configured and access to the code source. | D |
| NJM-98496 | Two-factor authentication | 2 | Checks the verification-options screen. | Header, email option text, radio list of the user's email addresses, a send button that mails a code and opens the code screen, a failure text if sending fails, and an example of the email. | Needs 2FA with email and a working mail setup. | D |
| NJM-98512 | Browser compatibility messages | 2 | Checks the login screen for an unsupported browser (credentials configured). | A recommendation to use Chrome or Firefox; other components as in the standard login screen. | Needs a browser the product treats as unsupported; the product's supported list is not stated. | D |
| NJM-98516 | Product start screens UI | 2 | Checks the screen shown while the product is starting. | Text "Starting, please wait..." and an automatic redirect to login when the product has started. | Transient state; needs a product restart. | D X |
| NJM-104803 | Logout section | 1 | Single step named "Profile" (the profile entry of the logout menu). | Only the generic localization sentence. | Does not say what the Profile entry shows or does. | G |

## Activities (12 cases)

| Key | Stratum | Steps | Purpose and flow | Expected-result summary | Dependencies, ambiguities, weaknesses | Flags |
|---|---|---|---|---|---|---|
| NJM-103495 | General | 1 | Check the activities list for running activities. | Generic localization sentence only. | Needs a running activity. | G D |
| NJM-103496 | General | 1 | Check the list for completed activities. | Generic only. | Needs a completed activity. | G D |
| NJM-103497 | General | 1 | Check the list for stopped activities. | Generic only. | Needs a stopped activity. | G D |
| NJM-103500 | Type | 3 | For the self-backup type: the list entry, a running activity's details popup, a past activity's details popup. | Generic only, three times. | Needs an activity of that type in both running and past states. | G D |
| NJM-103501 | Type | 3 | Same three checks for the individual file download type. | Generic only. | Needs file download activities in both states. | G D |
| NJM-103502 | Type | 3 | Same three checks for the individual file recovery to source type. | Generic only. | Needs file recovery activities in both states. | G D |
| NJM-103524 | UI | 2 | Search button; the first action lists the requirements (search by name, live search, results limited to 100); then a search with no result. | Generic only for both steps. | The action is a requirement list; no expectation for the no-result text. | G S |
| NJM-103525 | UI | 2 | Running activities list with activities running, and with none. | Generic only. | Needs both states, including an empty running list. | G D |
| NJM-103526 | UI | 2 | Past activities list when there are none but some are running, and when there are past activities. | Generic only. | The first state (no past activities) is hard to arrange. | G D |
| NJM-103529 | Error handling | 1 | Restarting an activity whose item was removed from the inventory (VMware variant); the action holds the required message ("does not exist, cannot restart"). | Generic only. | Message text sits in the action field; the step text is the same as in the instance variant; refers to a deprecated and a to-be-implemented ticket; removing inventory items is destructive. | G S U M D X |
| NJM-103530 | Error handling | 1 | Same, instance variant. | Generic only. | Same as NJM-103529. | G S U M D X |
| NJM-103538 | Error handling | 2 | File-level-recovery variant: (a) a virtual mount that mounts no disk shows a "disk is not mounted" text; (b) an unreachable recovery server shows an error message with a help link. | Generic only for both. | Messages sit in the action fields; needs fault injection; (b) refers to a to-be-implemented ticket and a help link that is still undefined. | G S U D X |

## Overview (12 cases)

| Key | Stratum | Steps | Purpose and flow | Expected-result summary | Dependencies, ambiguities, weaknesses | Flags |
|---|---|---|---|---|---|---|
| NJM-98607 | Summary bar | 1 | Check how the summary bar shows more than 999 issues or alarms for jobs, nodes, repositories, monitored items and activities (single-tenant product). | Generic only. | Needs very large alarm counts; the expected display is not described. | G D |
| NJM-98616 | Agenda widget | 1 | Check the Agenda widget at several zoom levels and resolutions. | Detailed: the widget is named "Agenda"; it lists activities by date, the same ones as on the Activities dashboard and the scheduled ones as on the Calendar; a week navigator shows the Monday-to-Sunday range of the shown week with an example; the right and left arrows move the week and the table; the Today button returns to the current week. | Many assertions in one step; relies on data in the Activities and Calendar views; zoom and resolution variation is not specified. | D |
| NJM-98625 | Total backup storage widget | 1 | Check the widget at several zoom levels and resolutions. | Generic sentence plus a spec link. | The expectation is a link. | G L |
| NJM-98628 | Speed widget | 1 | Same check. | Generic sentence plus a spec link. | The expectation is a link. | G L |
| NJM-98631 | Job statistic widget | 1 | Same check. | Generic sentence plus a spec link. | The expectation is a link; a localization defect is linked. | G L |
| NJM-98633 | Node tasks widget | 1 | Same check. | Generic sentence plus a spec link. | The link points to the Job statistic widget section, not the node tasks section named in the description (mismatch); the widget is marked to be implemented. | G L U M |
| NJM-98635 | Backup size widget | 1 | Same check. | Generic sentence plus a spec link. | The expectation is a link. | G L |
| NJM-98638 | Jobs widget | 1 | Same check. | Generic sentence plus a spec link. | The expectation is a link. | G L |
| NJM-98640 | Repositories widget | 1 | Same check. | Generic sentence plus a spec link. | The expectation is a link. | G L |
| NJM-98642 | Nodes widget | 1 | Same check. | Generic sentence plus a spec link. | The widget is marked to be implemented; a localization defect is linked. | G L U |
| NJM-98644 | Events widget | 1 | Check widget loading times, page changes, broken UI and truncation with 100,000 to 500,000 events. | **Empty.** | No expected result and no time limit for "loading times"; needs a very large event volume. | E D X |
| NJM-98655 | General | 1 | Check the dashboard when the user lacks permission for a functionality. | Generic sentence plus: affected widgets show an empty UI with a "no permissions" text; an example with the Nodes permission set to no access (marked to be implemented) emptying the Nodes and Node tasks widgets. | A stray line about "no transporter nodes" belongs to a different case; needs a restricted user; one example is unimplemented. | U M D |

## Data-quality findings

1. **The selected cases are localization checks, not functional cases.** All 36 carry the label Localization. Their expected results begin with the same generic sentence about the installer's language, breaking UI and truncation, followed in some cases by spec-derived requirements.
2. **23 of 36 cases have no functional expectation:** 22 have only the generic sentence (Activities 12, Overview 9, Authentication 1), and 1 has an empty expected result (NJM-98644).
3. **No case has a pre-condition or test data**, although 26 of the 36 need a specific state, data or environment (flag D).
4. **Action fields often hold requirements, not actions** (NJM-98477, 98494, 103524, 103529, 103530, 103538), and in the Activities error cases the message text sits in the action while the expected result is generic.
5. **8 cases refer to features marked to be implemented or deprecated** (NJM-98472, 98473, 103529, 103530, 103538, 98633, 98642, 98655); NJM-98472 explicitly tells the tester to abort some steps.
6. **Mismatched or duplicated content:** NJM-98633 (link points to another widget), NJM-98655 (stray line), NJM-103529 and NJM-103530 (identical step text across platform variants).
7. **Cases with side effects or risk:** NJM-98472 (creates a user), NJM-98477 and NJM-98494 (lockout counter), NJM-98516 (product restart), NJM-103529, 103530 and 103538 (inventory removal or fault injection), NJM-98644 (data volume).

## Cases requiring special attention

- **NJM-98644:** empty expected result, no time threshold, very large data volume. As the owner noted, it is an atypical case that the tie-break selected; it is recorded here, not removed.
- **NJM-98633:** the spec link points to a different widget.
- **NJM-98655:** contains an unrelated expectation line and depends on an unimplemented example.
- **NJM-98472:** creates a user and tells the tester to skip unimplemented steps.
- **NJM-98477 and NJM-98494:** exercise a lockout mechanism.
- **NJM-98616:** the only Overview case with a detailed expectation (many assertions in one step).
- **NJM-103529, NJM-103530, NJM-103538:** message text in the action field, unimplemented references, and fault-injection or inventory-removal dependencies.
