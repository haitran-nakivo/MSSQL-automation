import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-171448: "Backup - Step 3 - Schedule - Immutable check Dedup Appliance repository".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_DEDUP (an Online Deduplication Appliance repository), NAKIVO_BK_IMMUTABLE_DAYS (whole days)
//   (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource). A missing value ends the test ABORTED.
// Side effects: creates job NJM-171448 with one Weekly schedule and immutability for NAKIVO_BK_IMMUTABLE_DAYS days, runs it once (one Full backup, IMMUTABLE for that many days: it stays in the repository),
//   tries to delete that backup from Settings > Repositories (only the backup of this job; a repository that wrongly allows it loses it), deletes the job in afterEach (backups kept).
// case-vs-ui: no Create/Edit schedule dialog: immutability is looked for in the inline schedule block (text "immutab"). The notes of the explored UI (Onboard and Azure repositories) do not list the field,
//   so its wording and place are UNVERIFIED; if the block shows no such control, step 3 fails with that message.
// case-vs-ui: steps 5-6 use Settings > Repositories > <repository> > Backups (row "..." > Delete, then the row text) - UNVERIFIED navigation and texts; the row text is attached as observed-outcome.
//   "Delete or overwrite" is covered by Delete only (a recovery point cannot be overwritten from the UI).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-171448');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try {
    await backupFlows.discardJobIfPresent(JOB);
  } catch {
    // Best effort: the original failure is what the report shows.
  }
  jobCreated = false;
});

test('NAKIVO makes the recovery point immutable when the schedule sets an immutability period on a Deduplication Appliance repository', { tag: '@NJM-171448' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('DEDUP');
  const days = readBackupValue('IMMUTABLE_DAYS');
  const a6 = new BkA6ScheduleFlows(page, backupFlows);

  await test.step('1. Precondition: the Deduplication Appliance repository is Online and selectable, the database is in Inventory, no job named NJM-171448 exists', async () => {
    expect(days, 'NAKIVO_BK_IMMUTABLE_DAYS must be a whole number of days').toMatch(/^[1-9][0-9]*$/);
    if (await backupFlows.jobExists(JOB)) throw new Error(`ABORTED: a job named ${JOB} already exists; delete it and run again`);
  });

  await test.step('2. Open Data Protection > + > Backup for Database, select the database and the Deduplication Appliance repository and go to the Schedule step', async () => {
    await a6.openScheduleStep(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Enable immutability and set the period: the option is available for the Deduplication Appliance repository and the period is accepted', async () => {
    expect(await a6.hasImmutableControl(0), 'the schedule shows no immutability control for the Deduplication Appliance repository').toBe(true);
    await a6.setImmutable(0, Number(days));
    await expect(a6.ui.immutableDaysInput(0)).toHaveValue(days);
    testInfo.annotations.push({ type: 'observed-outcome', description: `immutability control text: ${await a6.ui.immutableLabel(0).innerText()}` });
  });

  await test.step('4. Finish the job and run it: a recovery point is created in the repository', async () => {
    await backupFlows.next();
    await backupFlows.setJobName(JOB);
    await a6.finish('finishAndRun');
    jobCreated = true;
    expect(await backupFlows.waitForResult(600_000)).toBe('successful');
    await expect(page.getByText(repo, { exact: false }).filter({ visible: true }).first()).toBeVisible();
  });

  await test.step('5. Attempt to delete the recovery point before the immutability period expires: it cannot be deleted', async () => {
    const attempt = await a6.tryDeleteRepositoryBackup(repo, JOB);
    testInfo.annotations.push({ type: 'observed-outcome', description: `delete attempt: ${JSON.stringify(attempt)}` });
    expect(attempt.reachedRow, 'the backup of the job was not found on the repository page (UNVERIFIED navigation)').toBe(true);
    expect(attempt.deleteDisabled || attempt.rowStillListed, 'the immutable backup was deleted').toBe(true);
  });

  await test.step('6. The recovery point shows an immutable status with the configured expiry', async () => {
    await a6.openRepository(repo);
    const row = await a6.repositoryBackupTexts(JOB);
    testInfo.annotations.push({ type: 'observed-outcome', description: `repository backup row: ${row.join(' | ')}` });
    expect(row.join(' '), 'the repository backup row shows no immutable status (UNVERIFIED location)').toMatch(/immutab/i);
  });
});
