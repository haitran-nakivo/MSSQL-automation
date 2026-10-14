import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154753: "[DBM-BK-UI-Source-Left Pane-0014] Verify Block Run on Empty Selection".
// Env (.env, owner-supplied): none beyond the Director login (the Inventory must hold at least one SQL item).
// Side effects: none expected; afterEach deletes a job named NJM-154753 if the Director wrongly created one.
// case-vs-ui: the case says "attempt to run/finish with an empty selection": Finish and Finish & Run exist only on the last step (Options), so the block is on Next
//   (Observed: Next with no source stays on Step 1). The check also tries the clickable step header "Options" and asserts that Finish & Run never becomes available.
// Ad hoc (negative): after the attempts the job list still has no job named NJM-154753.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154753');
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

test('NAKIVO does not let a backup job be run while no source is selected', { tag: '@NJM-154753' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Ensure no source is selected', async () => {
    expect((await flows.readTree()).filter((n) => n.checked)).toHaveLength(0);
    await expect(flows.sources.selectionSummary).toHaveText(/Select at least one item on the left/);
  });

  await test.step('4. Attempt to proceed towards Run with an empty selection: Next stays on Step 1 and Finish & Run is not offered', async () => {
    expect(await flows.tryNext(), 'the wizard advanced to Step 2 with no source').toBe(false);
    await expect(flows.sources.selectionSummary).toBeVisible();
    try {
      await flows.sources.stepTab('Options').click({ timeout: 3_000 });
    } catch {
      /* the header tab is not clickable before the step was reached: also a block */
    }
    await expect(flows.backup.wizard.finishAndRunButton).toBeHidden();
    await expect(flows.backup.wizard.finishButton).toBeHidden();
    await expect(flows.sources.selectionSummary).toBeVisible();
  });

  await test.step('Ad hoc (negative): cancelling the wizard leaves no job named NJM-154753', async () => {
    await flows.leaveWizard();
    jobCreated = true;
    expect(await flows.backup.jobExists(JOB)).toBe(false);
    jobCreated = false;
  });
});
