import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154750: "[DBM-BK-UI-Source-Left Pane-0011] Verify Selection Behaviors (Standard)".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_DB_SIMPLE (a database on an Inventory item).
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the standard "Wizards - Selection in the Left Pane" text is not available; the asserted behaviour is the case's: a click on the label highlights the row,
//   the checkbox toggles checked / unchecked. Whether a label click also ticks the box is recorded (observed-outcome), so the checkbox steps assert a toggle relative to that state.
// UNVERIFIED: the "highlighted" state is read from a selected / focused class on the row.
test.use(RUN_OPTIONS);

test('NAKIVO highlights a clicked source row and toggles its checkbox in the Step 1 tree', { tag: '@NJM-154750' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  let afterLabel = false;

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
    expect(await flows.isChecked(db)).toBe(false);
  });

  await test.step('3. Click the database label: the row is selected (highlighted)', async () => {
    await flows.clickLabel(db);
    await expect.poll(async () => (await flows.readTree()).find((n) => n.name === db)?.highlighted, { timeout: 10_000, message: 'the row is not highlighted after a click on its label' }).toBe(true);
    afterLabel = await flows.isChecked(db);
    testInfo.annotations.push({ type: 'observed-outcome', description: `checkbox state after a click on the label: ${afterLabel}` });
  });

  await test.step('4. Click the item checkbox: its checked state changes', async () => {
    await flows.clickCheckbox(db);
    await expect.poll(() => flows.isChecked(db), { timeout: 10_000, message: 'the checkbox did not toggle' }).toBe(!afterLabel);
  });

  await test.step('5. Click the checkbox again: it returns to the previous state', async () => {
    await flows.clickCheckbox(db);
    await expect.poll(() => flows.isChecked(db), { timeout: 10_000, message: 'the checkbox did not toggle back' }).toBe(afterLabel);
  });

  await flows.leaveWizard();
});
