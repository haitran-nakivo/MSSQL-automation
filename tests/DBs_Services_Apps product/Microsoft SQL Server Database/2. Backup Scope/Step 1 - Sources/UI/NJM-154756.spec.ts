import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154756: "[DBM-BK-UI-Source-Left Pane-0017] Verify Next on Container Selection".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM (the container = a standalone instance item).
// Side effects: none (opens the wizard and cancels it).
// Ad hoc (negative): the same Next on an empty selection stays on Step 1 (covered in depth by NJM-154753 / NJM-154754).
test.use(RUN_OPTIONS);

test('NAKIVO lets the user proceed to Step 2 when only a container (SQL instance) is selected', { tag: '@NJM-154756' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const item = readBackupValue('INSTANCE_ITEM');

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('Ad hoc (negative): Next with nothing selected stays on Step 1', async () => {
    expect(await flows.tryNext()).toBe(false);
    await expect(flows.sources.selectionSummary).toBeVisible();
  });

  await test.step('3. Tick the checkbox of one SQL instance: the instance is selected', async () => {
    await flows.clickCheckbox(item);
    await expect.poll(() => flows.isChecked(item), { timeout: 10_000 }).toBe(true);
  });

  await test.step('4. Click Next: the wizard proceeds to Step 2 (Destination)', async () => {
    expect(await flows.tryNext(), 'the wizard did not reach Step 2').toBe(true);
    await expect(flows.sources.destinationLabel()).toBeVisible();
  });

  await flows.leaveWizard();
});
