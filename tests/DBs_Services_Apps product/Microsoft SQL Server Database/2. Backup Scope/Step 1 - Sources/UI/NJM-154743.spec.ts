import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154743: "[DBM-BK-UI-Source-Left Pane-0005-1] Verify Live Search Behavior".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_DB_SIMPLE (a database name; its first 4 characters are the partial search term, the case uses "DB_Test").
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the case says "Only databases whose names match remain visible": the observed UI keeps the item headers and filters databases by name; item rows are therefore not counted.
test.use(RUN_OPTIONS);

test('NAKIVO filters the Step 1 source tree live while a partial database name is typed and deleted', { tag: '@NJM-154743' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  const term = db.slice(0, 4);
  const databaseRows = async () => (await flows.readTree()).filter((n) => n.depth > 0).map((n) => n.name);
  let unfiltered = 0;
  let filtered = 0;

  await test.step('1. Precondition and 2. open the wizard: Step 1 lists the databases', async () => {
    await flows.openStep1();
    unfiltered = (await databaseRows()).length;
    expect(unfiltered).toBeGreaterThan(0);
  });

  await test.step(`3. Type a partial database name ("${term}"): the tree filters as the text is entered`, async () => {
    await flows.typeSearch(term);
    await expect.poll(async () => (await databaseRows()).every((n) => n.toLowerCase().includes(term.toLowerCase())), { timeout: 15_000, message: 'the tree still shows non-matching databases' }).toBe(true);
  });

  await test.step('4. Observe the filtered results: only matching databases remain, the typed database is among them', async () => {
    const names = await databaseRows();
    filtered = names.length;
    expect(names).toContain(db);
    for (const name of names) expect(name.toLowerCase()).toContain(term.toLowerCase());
  });

  await test.step('5. Delete characters from the search field: the results update live to the shorter term', async () => {
    const field = flows.sources.searchField;
    await field.press('Backspace');
    await field.press('Backspace');
    await field.press('Backspace');
    await expect.poll(async () => (await databaseRows()).every((n) => n.toLowerCase().includes(term.slice(0, 1).toLowerCase())), { timeout: 15_000 }).toBe(true);
    expect((await databaseRows()).length, 'a shorter term must not show fewer databases').toBeGreaterThanOrEqual(filtered);
  });

  await flows.leaveWizard();
});
