import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkKit } from '../../../../../../helpers/bkA1-steps';

// NJM-159782: "Verify schedule run orders: Full > Differential > Log. (Ref: MSSQL-BK-Exe-0011)".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates job NJM-159782 with three Periodic schedules (Log, Differential, Full, every 1 minute, due at the same time); the job is disabled and deleted in afterEach (backups kept); adds a small table qa_bk_changes (dropped in afterEach); the recovery model is set to FULL if it differs and restored.
// MSSQL-BK-Exe-0011: the schedules are created in the reverse order (Log, Differential, Full) so the priority, not the list order, decides. A Full run already exists, so a Full schedule means a new Full.
// case-vs-ui: schedules are inline in the Schedule step; "Prioritize schedules" is ticked by default; skipped runs log "... was skipped ... due on a higher priority schedule" (observed 2026-10-08).
// UNVERIFIED locators relied on (inferred from the notes, never seen live): the job page Edit button, "Add another schedule" twice, the Periodic "Run every" number and unit inputs, the self-backup warning dialog.
test.use(RUN_OPTIONS);

let kit: BkKit | undefined;
test.afterEach(async () => {
  await kit?.cleanup();
  kit = undefined;
});

const SCHEDULES = [
  { name: 'NJM-159782-log', sqlBackupType: 'Log' as const, everyMinutes: 1 },
  { name: 'NJM-159782-diff', sqlBackupType: 'Differential' as const, everyMinutes: 1 },
  { name: 'NJM-159782-full', sqlBackupType: 'Full' as const, everyMinutes: 1 },
];

test(
  'NAKIVO runs only the Full backup when Full, Differential and Log schedules are due at the same time',
  { tag: '@NJM-159782' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(1_500_000);
    kit = new BkKit({ key: 'NJM-159782', kind: 'INSTANCE', model: 'FULL' }, { page, backupFlows, testInfo });
    kit.commonCaseVsUi();

    await test.step('1. Precondition: the FULL-recovery database is in Inventory, the repository is named, and a base Full run exists', async () => {
      await kit.checkInventory();
      kit.checkRepositoryNamed();
      await kit.setRecoveryModel();
      await kit.openWizardOnSource();
      await kit.selectDatabase();
      await kit.chooseRepository();
      await kit.fillOnDemandAndName();
      await kit.finishAndRunFirstFull();
      await kit.waitSuccess();
      await kit.expectNewRecoveryPoints(['D'], false);
      await kit.changeData();
    });

    await test.step('2. Open the job (Edit, Schedule step) and configure Log, Differential and Full Periodic schedules with the same window: all three are saved', async () => {
      await kit.addPeriodicSchedules(SCHEDULES);
    });

    await test.step('3. Trigger the schedules: all three become due in the same minute and the job starts by itself', async () => {
      await kit.waitForScheduledRun(SCHEDULES[2].name);
    });

    await test.step('4. Monitor the execution order: the Full runs, the Differential and Log are skipped for a higher priority schedule', async () => {
      const skipped = await kit.skippedForPriorityLine();
      expect(skipped, 'the job page shows no "skipped ... higher priority schedule" line').not.toBe('');
      testInfo.annotations.push({ type: 'observed-outcome', description: 'skipped line: ' + skipped });
    });

    await test.step('5. Inspect the recovery points: the first is Full and no Differential or Log was created while Full was due', async () => {
      await kit.expectFirstScheduledRunType('D');
      await kit.expectOnlyTypes(['D']);
    });

    await test.step('6. Check the job result and events: the due backup completed with no failure or ordering alarm', async () => {
      await kit.annotateHistory('after the coinciding schedules');
      await kit.expectNoFailureAndHealthyDatabase();
    });
  },
);
