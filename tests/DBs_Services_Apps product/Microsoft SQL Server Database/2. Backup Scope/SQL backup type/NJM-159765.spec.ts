import { test } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { BkKit } from '../../../../../helpers/bkA1-steps';

// NJM-159765: "[MSSQL-BK-Types-0006-2] Verify Bulk-Logged Model: Full Backup".
// Env (.env, owner-supplied): NAKIVO_BK_FCI_ITEM, NAKIVO_BK_FCI_DB_BULK_LOGGED, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_FCI_* SQL login).
// Side effects: creates job NJM-159765 (deleted in afterEach, backups kept); runs one Full backup of the database; the recovery model is set to BULK_LOGGED if it differs and restored in afterEach.
// case-vs-ui: the wizard has 4 steps (Source, Destination, Schedule, Options); "Create > Microsoft SQL Server backup job" is Data Protection > + > Backup for Database.
// case-vs-ui: the case says "run on demand as a Full backup"; a never-run job has no type choice in the Run dialog and its first run is Full.
// case-vs-ui: recovery point "Incremental" in the case = msdb type D (Full); the recovery points are asserted from msdb.backupset (device_type 7 = NBR); the Recover picker is only tried and attached.
// Ad hoc steps (beyond the case text): Next is blocked on the Source step while nothing is ticked.
test.use(RUN_OPTIONS);

let kit: BkKit | undefined;
test.afterEach(async () => {
  await kit?.cleanup();
  kit = undefined;
});

test(
  'NAKIVO runs a Full backup of a BULK_LOGGED-recovery database on a failover cluster instance',
  { tag: '@NJM-159765' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    kit = new BkKit({ key: 'NJM-159765', kind: 'FCI', model: 'BULK_LOGGED' }, { page, backupFlows, testInfo });
    kit.commonCaseVsUi();

    await test.step('1. Precondition: the a failover cluster instance item is in Inventory (application-aware, discovered)', async () => {
      await kit.checkInventory();
    });

    await test.step('2. Precondition: a Stream backup repository is available as a destination', async () => {
      kit.checkRepositoryNamed();
    });

    await test.step('3. Set the recovery model of the target database to BULK_LOGGED on the SQL Server', async () => {
      await kit.setRecoveryModel();
    });

    await test.step('4. Open Data Protection, + > Backup for Database: the wizard opens on the Source step', async () => {
      await kit.openWizardOnSource();
    });

    await test.step('Ad hoc (negative): with nothing ticked Next stays on the Source step', async () => {
      await kit.nextIsBlockedWithoutSource();
    });

    await test.step('5. Select the target database under the item', async () => {
      await kit.selectDatabase();
    });

    await test.step('6. On the Destination step select the stream repository', async () => {
      await kit.chooseRepository();
    });

    await test.step('7. Finish the wizard and run the job on demand as a Full backup: it shows as running', async () => {
      await kit.fillOnDemandAndName();
      await kit.finishAndRunFirstFull();
    });

    await test.step('8. Wait for the job to finish: it completes successfully with no failure', async () => {
      await kit.waitSuccess();
    });

    await test.step('9. Check the created recovery point: one recovery point of type Full (msdb type D)', async () => {
      await kit.expectNewRecoveryPoints(['D']);
    });
  },
);
