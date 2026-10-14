import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-171407: "Backup - Step 1 - Sources: Verify Backup individual DB for AG SQL".
// Env (.env, owner-supplied): NAKIVO_BK_AG_ITEM (the Always On Availability Group item), NAKIVO_BK_AG_DB_FULL (one database on it; a FULL-recovery database is used so that the same recipe fits every source type),
//   NAKIVO_BK_REPO_PRIMARY (an Online stream repository) and the NAKIVO_MSSQL_AG_* login (used only to list the item's other databases). A missing value ends the test ABORTED ("Missing in .env").
// Side effects: creates job NJM-171407 (on demand) and runs one Full backup of the single database (20 to 70 s); the job is deleted in afterEach, the backup is kept.
// case-vs-ui: the wizard has 4 steps (Source, Destination, Schedule, Options); "Retention" is inline in Schedule, so step 5 sets Destination, on-demand Schedule and the job name, then Finish & Run.
// case-vs-ui: "Monitor the job in Activities" is done on the job page (status line "Last run was successful"); "open the recovery point in the repository" is checked on the job page (only the selected
//   database is listed, no other database of the item appears, Recover is available); browsing the repository's backup list was not explored in the UI notes.
// Ad hoc (negative): the other databases of the item are not ticked and do not appear on the job page.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-171407');
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

test('NAKIVO backs up one individual database of a Always On Availability Group SQL Server item and saves only that database', { tag: '@NJM-171407' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(900_000);
  const flows = new BkA3SourcesFlows(page);
  const source = readBackupSource('AG');
  const db = readBackupDatabase('AG', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  let others: string[] = [];

  await test.step('1. Precondition: the Always On Availability Group item and its databases appear in Inventory', async () => {
    const rows = await flows.readInventoryRows();
    expect(BkA3SourcesFlows.positionsIn(rows, [source.item])[0], `Inventory does not list "${source.item}"`).toBeGreaterThanOrEqual(0);
  });

  await test.step('2. Open the wizard: it opens on Step 1 (Source)', async () => {
    await flows.openStep1();
    await expect(flows.backup.wizard.title).toBeVisible();
  });

  await test.step('3. Expand the Always On Availability Group item and tick one individual database: only that database is checked', async () => {
    const tree = await flows.tickSingleDatabase(source.item, db);
    const children = await flows.childrenOf(source.item);
    expect(children).toContain(db);
    const checkedUnderItem = tree.filter((n) => n.depth > 0 && n.checked).map((n) => n.name);
    expect(checkedUnderItem).toEqual([db]);
    expect(await flows.paneCount(db)).toBe(1);
    try {
      others = (await sqlHostFor(source).databaseNames()).filter((name) => name !== db && name !== 'tempdb');
    } catch (error) {
      testInfo.annotations.push({ type: 'observed-outcome', description: `could not list the other databases from the SQL host: ${String(error).slice(0, 120)}` });
    }
  });

  await test.step('4. Click Next, then on Step 2 select a stream repository: the destination is set and the wizard advances', async () => {
    expect(await flows.tryNext(), 'the wizard did not reach Step 2').toBe(true);
    await flows.backup.chooseDestination(repo);
    await expect(flows.sources.destinationLabel()).toBeVisible();
    await flows.backup.next();
    await expect(flows.backup.wizard.onDemandCheckbox).toBeVisible();
  });

  await test.step('5. Complete Schedule (on demand) and Options (job name) and click Finish & Run: the job is created and starts running', async () => {
    await flows.backup.setOnDemand();
    await flows.backup.next();
    await flows.backup.setJobName(JOB);
    await flows.finishAndRun();
    jobCreated = true;
    await flows.waitJobPage();
  });

  await test.step('6. Monitor the job until it completes: it ends successfully with no errors', async () => {
    const outcome = await flows.backup.waitForResult(600_000);
    expect(outcome, `the run ended "${outcome}": ${await flows.backup.readStatusLine().catch(() => '')}`).toBe('successful');
  });

  await test.step('7. Check the recovery point: only the selected database was backed up to the repository', async () => {
    const texts = await flows.jobPageTexts();
    expect(texts, 'the job page does not list the selected database').toContain(db);
    expect(others.filter((name) => texts.includes(name)), 'other databases of the item appear on the job page').toEqual([]);
    await expect(flows.backup.jobs.recoverButton).toBeVisible();
    expect(await flows.isEnabled(flows.backup.jobs.recoverButton), 'Recover is disabled after a successful run').toBe(true);
  });
});
