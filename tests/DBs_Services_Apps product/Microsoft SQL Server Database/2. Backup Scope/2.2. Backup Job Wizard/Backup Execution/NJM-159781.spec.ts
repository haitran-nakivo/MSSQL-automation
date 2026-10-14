import { test } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkKit } from '../../../../../../helpers/bkA1-steps';

// NJM-159781: "Verify Log Backups schedule run (Ref: MSSQL-BK-Exe-0008-2))".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates job NJM-159781 with a Periodic schedule every 1 minute (the job is disabled and deleted in afterEach, backups kept; it may run once or twice more while the test checks); adds a small table qa_bk_changes (dropped in afterEach); the recovery model is set to FULL if it differs and restored.
// MSSQL-BK-Exe-0008-2: the case says "due to trigger shortly"; the spec uses the shortest Periodic schedule (every 1 minute) instead of waiting for a weekly slot.
// case-vs-ui: schedules are inline in the Schedule step of the wizard (no Create-schedule dialog); the schedule is added through the job Edit wizard.
// UNVERIFIED locators relied on (inferred from the notes, never seen live): the job page Edit button, the Periodic "Run every" number and unit inputs, the self-backup warning dialog (02:00), the text "Schedule: <name>" on the job page.
test.use(RUN_OPTIONS);

let kit: BkKit | undefined;
test.afterEach(async () => {
  await kit?.cleanup();
  kit = undefined;
});

const SCHEDULE = 'NJM-159781-log';

test(
  'NAKIVO starts a Log backup by itself from a Periodic schedule and creates a Log recovery point',
  { tag: '@NJM-159781' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(1_500_000);
    kit = new BkKit({ key: 'NJM-159781', kind: 'INSTANCE', model: 'FULL' }, { page, backupFlows, testInfo });
    kit.commonCaseVsUi();

    await test.step('1. Precondition: the FULL-recovery database is in Inventory and the stream repository is named in .env', async () => {
      await kit.checkInventory();
      kit.checkRepositoryNamed();
      await kit.setRecoveryModel();
    });

    await test.step('2. Create the job and run it once as Full to establish the base recovery point', async () => {
      await kit.openWizardOnSource();
      await kit.selectDatabase();
      await kit.chooseRepository();
      await kit.fillOnDemandAndName();
      await kit.finishAndRunFirstFull();
      await kit.waitSuccess();
      await kit.expectNewRecoveryPoints(['D'], false);
      await kit.changeData();
    });

    await test.step('3. Open the job (Edit, Schedule step) and add a Periodic schedule every 1 minute with SQL backup type = Log: it is saved', async () => {
      await kit.addPeriodicSchedules([{ name: SCHEDULE, sqlBackupType: 'Log', everyMinutes: 1 }]);
    });

    await test.step('4. Wait for the next minute: the job starts by itself and the job page names the schedule', async () => {
      await kit.waitForScheduledRun(SCHEDULE);
    });

    await test.step('5. Inspect the recovery point of the automatic run: the first one is of type Log (msdb type L)', async () => {
      await kit.expectFirstScheduledRunType('L');
      await kit.attachRecoveryPointList();
    });

    await test.step('6. Check the job result and events: the scheduled Log backup completed with no failure', async () => {
      await kit.annotateHistory('after the scheduled Log run');
      await kit.expectNoFailureAndHealthyDatabase();
    });
  },
);
