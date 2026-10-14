import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178362: "[MSSQL-BKC-SRC-05] Verify selecting a container auto-includes future databases".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-178362-src on the whole instance, Backup Copy job NJM-178362 and the SQL database NJM178362_new (all removed in afterEach: both jobs with their backups, the database dropped). ABORTED when the target already holds a backup of the instance database or a database NJM178362_new exists.
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: the cases say "Jobs > Create > Backup copy job for Microsoft SQL Server": the UI entry is Data Protection > + > Backup Copy Job (a Microsoft SQL Server choice may follow; UNVERIFIED).
// case-vs-ui: the cases describe five steps (Source, Destination, Schedule, Retention, Options); the wizard is only checked for the steps it really shows (CopyFlows.presentSteps) and a missing step is recorded as case-vs-ui.
test.use(RUN_OPTIONS);

let copy: CopyFlows | undefined;
let dropNewDatabase: (() => Promise<void>) | undefined;
test.afterEach(async () => {
  try {
    await dropNewDatabase?.();
  } catch {
    /* best effort */
  }
  dropNewDatabase = undefined;
  try {
    await copy?.cleanup();
  } catch {
    /* best effort */
  }
  copy = undefined;
});

test(
  'NAKIVO Backup Copy job with a container (instance) as source automatically includes a database added later',
  { tag: '@NJM-178362' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(2700000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupDatabase('INSTANCE', 'FULL');
    const primary = readBackupRepo('PRIMARY');
    const secondary = readBackupRepo('SECONDARY');
    const host = sqlHostFor(source);
    const newDb = 'NJM178362_new';
    const srcJob = backupJobName('NJM-178362', '-src');
    const copyJob = backupJobName('NJM-178362');
    const request = { name: copyJob, item: source.item, destination: secondary };

    await test.step('1. Precondition: a SQL backup job whose source is the container exists', async () => {
      if ((await host.databaseNames()).includes(newDb)) throw new Error('ABORTED: a database named ' + newDb + ' already exists on the instance');
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) throw new Error('ABORTED: the target already holds a backup of ' + db);
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, repo: primary, types: ['Full'] }, 900_000);
      expect(outcomes, 'the container-level source backup ends successfully').toEqual(['successful']);
    });

    await test.step('2. Open the Backup Copy Job wizard', async () => {
      await flow.openWizard();
      await expect(flow.wizard.title, 'the Backup Copy Job wizard opens').toBeVisible();
      await expect(flow.wizard.stepTab('Source').first(), 'the wizard starts on the Source step').toBeVisible();
      if ((await flow.wizard.treeRow(source.item).count()) === 0) {
        throw new Error('ABORTED: the Source tree lists no item ' + source.item + '; a SQL backup with recovery points of it must exist first (run a backup job for it)');
      }
    });

    await test.step('3. Select the container (SQL instance) node as the copy source', async () => {
      await backupFlows.selectSources([{ item: source.item }]);
      await expect(flow.wizard.selectionSummary, 'the container is selected').toContainText(/item\(s\) were added to this job/);
    });

    await test.step('4. Complete and run the copy job, then add a new database and back it up', async () => {
      await flow.completeFromSource(request);
      expect(await backupFlows.jobExists(copyJob), 'the Backup Copy job is listed').toBe(true);
      expect(await flow.runJob(copyJob, 1_200_000), 'the first copy run ends successfully').toBe('successful');
      await host.createDatabase(newDb);
      dropNewDatabase = async () => {
        await host.dropDatabaseIfExists(newDb);
      };
      expect(await flow.runSource(srcJob, 'Full', 900_000), 'the source backup that includes the new database ends successfully').toBe('successful');
    });

    await test.step('5. Run the Backup Copy job again: the new database is copied without editing the selection', async () => {
      expect(await flow.runJob(copyJob, 1_200_000), 'the second copy run ends successfully').toBe('successful');
      const targetTexts = await flow.repositoryTexts(secondary);
      expect(targetTexts.some((t) => t.includes(newDb)), 'the new database ' + newDb + ' is on the target').toBe(true);
    });
  },
);
