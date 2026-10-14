import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154754: "[DBM-BK-UI-Source-Left Pane-0015] Verify Block Save on Empty Selection".
// Env (.env, owner-supplied): none beyond the Director login (the Inventory must hold at least one SQL item).
// Side effects: none expected; afterEach deletes a job named NJM-154754 if the Director wrongly created one.
// case-vs-ui: the case says "Click Finish/Save ... a validation message prompts selecting at least one item": Finish exists only on the last step, so the block is on Next.
//   Observed: Next with no source stays on Step 1 without an invalid mark; the prompt is the right-pane text "Select at least one item on the left" (always shown while nothing is selected).
// Ad hoc (negative): the job list has no job named NJM-154754 afterwards.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154754');
let jobCreated = false;
test.afterEach(async ({ page }) => {
  if (!jobCreated) return;
  try {
    await new BkA3SourcesFlows(page).backup.discardJobIfPresent(JOB);
  } catch {
    /* best effort */
  }
  jobCreated = false;
});

test('NAKIVO does not let a backup job be saved while no source is selected and prompts to select an item', { tag: '@NJM-154754' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Ensure no source is selected', async () => {
    expect((await flows.readTree()).filter((n) => n.checked)).toHaveLength(0);
  });

  await test.step('4. Try to move on towards Finish: the wizard stays on Step 1 and the prompt to select an item is shown', async () => {
    expect(await flows.tryNext(), 'the wizard advanced to Step 2 with no source').toBe(false);
    await expect(flows.sources.selectionSummary).toHaveText(/Select at least one item on the left/);
    await expect(flows.backup.wizard.finishButton).toBeHidden();
  });

  await test.step('Ad hoc (negative): cancelling the wizard leaves no job named NJM-154754', async () => {
    await flows.leaveWizard();
    jobCreated = true;
    expect(await flows.backup.jobExists(JOB)).toBe(false);
    jobCreated = false;
  });
});
