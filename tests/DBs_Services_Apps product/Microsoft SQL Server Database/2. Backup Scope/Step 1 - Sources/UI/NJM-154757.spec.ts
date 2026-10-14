import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupRepo, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154757: "[DBM-BK-UI-Source-Left Pane-0018] Verify Block Run until Children Selected".
// Env (.env, owner-supplied): NAKIVO_BK_EMPTY_INSTANCE_ITEM (an existing Inventory item with NO databases, new name for this case), NAKIVO_BK_INSTANCE_ITEM
//   (an item with databases), NAKIVO_BK_REPO_PRIMARY. A missing value ends the test ABORTED ("Missing in .env").
// Side effects: may create job NJM-154757 (on demand) and run it; deleted in afterEach (backups kept). The second part runs a Full backup of the whole instance item.
// case-vs-ui: the notes do not say what the Director does with an empty container. The test walks the wizard as far as the Director allows and records the outcome
//   (observed-outcome): blocked at Next, blocked at Finish & Run, or a run that does not end successfully. A run that ends "successful" for an empty container is a failed assertion.
// case-vs-ui: "attempt to run" with a valid instance asserts that the run ends successfully (whole-item Full backup, 20 to 70 s on the lab for 6 databases).
test.use(RUN_OPTIONS);

const EMPTY_JOB = backupJobName('NJM-154757', '-empty');
const VALID_JOB = backupJobName('NJM-154757', '-valid');
const created = new Set<string>();
test.afterEach(async ({ page }) => {
  const flows = new BkA3SourcesFlows(page);
  for (const name of created) {
    try {
      await flows.backup.discardJobIfPresent(name);
    } catch {
      /* best effort */
    }
  }
  created.clear();
});

test('NAKIVO blocks running a job whose container has no databases and allows it once an instance with databases is selected', { tag: '@NJM-154757' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(900_000);
  const flows = new BkA3SourcesFlows(page);
  const emptyItem = readBackupValue('EMPTY_INSTANCE_ITEM');
  const validItem = readBackupValue('INSTANCE_ITEM');
  const repo = readBackupRepo('PRIMARY');
  let blocked = false;

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Tick the empty SQL container: it is checked and no child database is shown', async () => {
    await flows.clickCheckbox(emptyItem);
    await expect.poll(() => flows.isChecked(emptyItem), { timeout: 10_000 }).toBe(true);
    const tree = await flows.readTree();
    const at = tree.findIndex((n) => n.name === emptyItem);
    expect(tree.some((n, i) => i === at + 1 && n.depth > tree[at].depth), 'the container shows child databases').toBe(false);
  });

  await test.step('4. Attempt to run the job: it is blocked or fails', async () => {
    if (!(await flows.tryNext())) {
      blocked = true;
      testInfo.annotations.push({ type: 'observed-outcome', description: 'Next is blocked for an empty container' });
      return;
    }
    await flows.backup.chooseDestination(repo);
    await flows.backup.next();
    await flows.backup.setOnDemand();
    await flows.backup.next();
    await flows.backup.setJobName(EMPTY_JOB);
    created.add(EMPTY_JOB);
    await flows.backup.wizard.finishAndRunButton.click({ timeout: 10_000 });
    try {
      await flows.backup.jobs.runDialog.waitFor({ timeout: 10_000 });
      await flows.backup.jobs.runDialogRunButton.click({ timeout: 10_000 });
    } catch {
      blocked = true;
      testInfo.annotations.push({ type: 'observed-outcome', description: 'Finish & Run did not open the Run dialog for an empty container' });
      return;
    }
    const outcome = await flows.backup.waitForResult(300_000);
    testInfo.annotations.push({ type: 'observed-outcome', description: `empty container run ended: ${outcome}` });
    expect(outcome, 'a job over an empty container ended successfully').not.toBe('successful');
    blocked = true;
  });

  await test.step('5. Select an instance that contains databases and run: the run is permitted and succeeds', async () => {
    expect(blocked, 'step 4 did not record a block').toBe(true);
    await flows.backup.gotoJobs();
    await flows.backup.openWizard();
    await flows.sources.treeRows().first().waitFor({ timeout: 30_000 });
    await flows.clickCheckbox(validItem);
    await expect.poll(() => flows.isChecked(validItem), { timeout: 10_000 }).toBe(true);
    await flows.fillToOptions(repo, VALID_JOB);
    created.add(VALID_JOB);
    await flows.finishAndRun();
    expect(await flows.backup.waitForResult(600_000), 'the whole-instance run did not succeed').toBe('successful');
  });
});
