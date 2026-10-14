import { test } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkKit } from '../../../../../../helpers/bkA1-steps';

// NJM-159792: "Verify backup to Stream repository - Deduplication Appliance (MSSQL-BK-Exe-0012)".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_DEDUP (the name of an existing Online Deduplication Appliance stream repository; the test ends ABORTED when it is not in .env) (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates job NJM-159792 (deleted in afterEach, backups kept); runs one Full backup of the database into the Deduplication Appliance repository; the recovery model is set to FULL if it differs and restored.
// MSSQL-BK-Exe-0012: one case per repository type; all ten share helpers/bkA1-steps.ts. The repository is an EXISTING lab object named in .env and is never created or changed here.
// case-vs-ui: the repository type (Deduplication Appliance) is not checked in the UI (no repository page is driven); it is taken from the .env role. "Online" is proven by the destination list offering the repository.
// case-vs-ui: the case says "configure schedule and retention"; the job is on demand (no schedule) and "Finish & Run" starts it. Wizard has 4 steps; first run is Full; recovery points come from msdb.backupset.
// Ad hoc step (beyond the case text): Next is blocked on the Source step while nothing is ticked.
test.use(RUN_OPTIONS);

let kit: BkKit | undefined;
test.afterEach(async () => {
  await kit?.cleanup();
  kit = undefined;
});

test(
  'NAKIVO backs up a SQL Server database to a Deduplication Appliance stream repository and creates a valid Full recovery point',
  { tag: '@NJM-159792' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(1_200_000);
    kit = new BkKit({ key: 'NJM-159792', kind: 'INSTANCE', model: 'FULL', repoRole: 'DEDUP' }, { page, backupFlows, testInfo });
    kit.commonCaseVsUi();

    await test.step('1. Precondition: the Deduplication Appliance stream repository is named in .env and the SQL Server database is in Inventory', async () => {
      await kit.checkInventory();
      kit.checkRepositoryNamed();
      await kit.setRecoveryModel();
    });

    await test.step('2. Open Data Protection, + > Backup for Database and select the database on the Source step', async () => {
      await kit.openWizardOnSource();
      await kit.nextIsBlockedWithoutSource();
      await kit.selectDatabase();
    });

    await test.step('3. On the Destination step select the Deduplication Appliance repository: it is accepted as the destination', async () => {
      await kit.chooseRepository();
    });

    await test.step('4. Leave the job on demand, finish the wizard and run it: the job is created and starts running', async () => {
      await kit.fillOnDemandAndName();
      await kit.finishAndRunFirstFull();
    });

    await test.step('5. Monitor the run to completion: the backup completes successfully', async () => {
      await kit.waitSuccess();
    });

    await test.step('6. Check the recovery points of the repository: a Full recovery point for the database was created', async () => {
      await kit.expectNewRecoveryPoints(['D']);
    });

    await test.step('7. Check for alarms and repository health: no failure on the job page, the database is healthy', async () => {
      await kit.expectNoFailureAndHealthyDatabase();
    });
  },
);
