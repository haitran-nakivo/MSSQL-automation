import { test } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { BkKit } from '../../../../../helpers/bkA1-steps';

// NJM-159762: "[MSSQL-BK-Types-0005-2] Verify Full Model: Log Backup".
// Env (.env, owner-supplied): NAKIVO_BK_FCI_ITEM, NAKIVO_BK_FCI_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_FCI_* SQL login).
// Side effects: creates job NJM-159762 (deleted in afterEach, backups kept); runs a Full and then a Log backup of the database; adds a small table qa_bk_changes to the database to generate changes (dropped in afterEach); the recovery model is set to FULL if it differs and restored in afterEach.
// case-vs-ui: the wizard has 4 steps (Source, Destination, Schedule, Options); "Create > Microsoft SQL Server backup job" is Data Protection > + > Backup for Database.
// case-vs-ui: the case finishes the wizard after the base Full; the UI cannot run a Full before Finish, so the job is finished with "Finish & Run" (first run = Full) and the next type is run from the job page (the Run dialog then offers the SQL backup type, default Log).
// case-vs-ui: recovery point "Incremental" in the case = msdb type L; the recovery points are asserted from msdb.backupset (device_type 7 = NBR); the Recover picker is only tried and attached.
// Ad hoc steps (beyond the case text): Next is blocked on the Source step while nothing is ticked.
test.use(RUN_OPTIONS);

let kit: BkKit | undefined;
test.afterEach(async () => {
  await kit?.cleanup();
  kit = undefined;
});

test(
  'NAKIVO runs a Log backup of a FULL-recovery database on a failover cluster instance',
  { tag: '@NJM-159762' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(900_000);
    kit = new BkKit({ key: 'NJM-159762', kind: 'FCI', model: 'FULL' }, { page, backupFlows, testInfo });
    kit.commonCaseVsUi();

    await test.step('1. Precondition: the a failover cluster instance item is in Inventory (application-aware, discovered)', async () => {
      await kit.checkInventory();
    });

    await test.step('2. Precondition: a Stream backup repository is available as a destination', async () => {
      kit.checkRepositoryNamed();
    });

    await test.step('3. Set the recovery model of the target database to FULL on the SQL Server', async () => {
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

    await test.step('7. Finish the wizard and run an initial Full backup so a base recovery point exists', async () => {
      await kit.fillOnDemandAndName();
      await kit.finishAndRunFirstFull();
      await kit.waitSuccess();
      await kit.expectNewRecoveryPoints(['D'], false);
    });

    await test.step('8. On the SQL Server perform transactions to generate transaction-log activity', async () => {
      await kit.changeData();
    });

    await test.step('9. Run the job on demand as a Log backup: it shows as running', async () => {
      await kit.runAs('Log');
    });

    await test.step('10. Wait for the job to finish: it completes successfully with no failure', async () => {
      await kit.waitSuccess();
    });

    await test.step('11. Check the created recovery point: one Log recovery point (msdb type L) linked to the earlier Full', async () => {
      await kit.expectNewRecoveryPoints(['L']);
    });
  },
);
