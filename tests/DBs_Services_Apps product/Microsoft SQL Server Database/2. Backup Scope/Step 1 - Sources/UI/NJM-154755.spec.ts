import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupRepo, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154755: "[DBM-BK-UI-Source-Left Pane-0016] Verify Save on Container Selection".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM (the container = a standalone instance item), NAKIVO_BK_REPO_PRIMARY (an Online repository).
// Side effects: creates job NJM-154755 (on demand, never run; deleted in afterEach).
// case-vs-ui: "Finish/Save" is Finish on Step 4 (Options); the wizard is walked through Destination (repository from .env), Schedule (on demand) and Options (job name).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154755');
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

test('NAKIVO saves a backup job whose only source is a container (a whole SQL instance)', { tag: '@NJM-154755' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const item = readBackupValue('INSTANCE_ITEM');
  const repo = readBackupRepo('PRIMARY');

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Tick the checkbox of the SQL instance: the instance and its databases are selected', async () => {
    await flows.clickCheckbox(item);
    await expect.poll(() => flows.isChecked(item), { timeout: 10_000 }).toBe(true);
    const tree = await flows.readTree();
    const at = tree.findIndex((n) => n.name === item);
    const children = [];
    for (let i = at + 1; i < tree.length && tree[i].depth > tree[at].depth; i++) children.push(tree[i]);
    expect(children.length).toBeGreaterThan(0);
    expect(children.filter((n) => !n.checked).map((n) => n.name), 'databases left unticked').toEqual([]);
    await expect(flows.sources.selectionSummary).toHaveText(/item\(s\) were added to this job/);
  });

  await test.step('4. Click Finish on the last step: the job is saved with the container selected', async () => {
    await flows.fillToOptions(repo, JOB);
    await flows.backup.wizard.finishButton.click({ timeout: 10_000 });
    jobCreated = true;
    await flows.waitJobPage();
    await expect(flows.backup.jobs.statusLine).toHaveText(/This job has not been executed yet/);
    expect(await flows.backup.jobExists(JOB)).toBe(true);
  });
});
