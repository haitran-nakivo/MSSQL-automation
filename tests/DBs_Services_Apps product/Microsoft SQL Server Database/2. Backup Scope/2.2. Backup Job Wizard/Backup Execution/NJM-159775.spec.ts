import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkKit } from '../../../../../../helpers/bkA1-steps';

// NJM-159775: "Verify Different Backup run interrupted by an external Log backup creation (Ref: MSSQL-BK-Exe-0002)".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates job NJM-159775 (deleted in afterEach, backups kept); runs a Full and a Differential run and takes native Log backups of the database (they break the chain on purpose); adds a small table qa_bk_changes (dropped in afterEach); the recovery model is set to FULL if it differs and restored.
// MSSQL-BK-Exe-0002: the external backup is issued while the NBR run is Running (best effort: the Full of a small database is quick, the NBR run takes 20-70 s).
// case-vs-ui: the case checks the chain stays consistent; the spec asserts the run ends successfully with a recovery point of the run type (msdb) and the database is ONLINE.
// case-vs-ui: the case wants "no unexpected alarm"; the chain-break warning sql4 is the documented outcome of the extra step and is asserted there (Diff/Log runs only).
// case-vs-ui: wizard has 4 steps; first run of a never-run job is Full; recovery points come from msdb.backupset (device 7 = NBR).
// Ad hoc step (beyond the case text): deterministic version - external backup first, then the next run.
test.use(RUN_OPTIONS);

let kit: BkKit | undefined;
test.afterEach(async () => {
  await kit?.cleanup();
  kit = undefined;
});

test(
  'NAKIVO completes a Differential backup that an external Log backup of the same database overlaps, and keeps the chain valid',
  { tag: '@NJM-159775' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(1_200_000);
    kit = new BkKit({ key: 'NJM-159775', kind: 'INSTANCE', model: 'FULL' }, { page, backupFlows, testInfo });
    kit.commonCaseVsUi();

    await test.step('1. Precondition: Director up, the SQL database is reachable in FULL recovery model, the stream repository is configured', async () => {
      await kit.checkInventory();
      kit.checkRepositoryNamed();
      await kit.setRecoveryModel();
    });

    await test.step('2. Create the job and run it once to create a Full recovery point the differential run depends on', async () => {
      await kit.openWizardOnSource();
      await kit.selectDatabase();
      await kit.chooseRepository();
      await kit.fillOnDemandAndName();
      await kit.finishAndRunFirstFull();
      await kit.waitSuccess();
      await kit.expectNewRecoveryPoints(['D'], false);
    });

    await test.step('3. Start the job as a Differential backup: it shows as running', async () => {
      await kit.changeData();
      await kit.runAs('Differential');
    });

    await test.step('4. While it runs, create an external (native) Log backup of the same database on the SQL Server', async () => {
      const stillRunning = await kit.externalBackup('LOG');
      testInfo.annotations.push({ type: 'observed-outcome', description: 'The NBR job was still Running when the external Log backup finished: ' + stillRunning });
    });

    await test.step('5. Wait for the NBR Differential backup to finish: it completes successfully and is not aborted', async () => {
      await kit.waitSuccess();
    });

    await test.step('6. Inspect the recovery point of the run: a valid Differential recovery point (msdb type I) is present', async () => {
      await kit.annotateHistory('after the interrupted Differential run');
      await kit.expectNewRecoveryPoints(['I']);
    });

    await test.step('7. Check the job events and the source database: no failure, the database is ONLINE in FULL recovery', async () => {
      await kit.expectNoFailureAndHealthyDatabase();
    });

    await test.step('Ad hoc: after an external Log backup the next Differential run creates a new Full and warns that the chain was broken (sql4)', async () => {
      await kit.changeData();
      await kit.externalBackup('LOG');
      await kit.runAs('Differential');
      await kit.waitFinished();
      await kit.expectNewRecoveryPoints(['D'], false);
      const warning = await kit.chainBreakWarning();
      expect(warning, 'no chain-break warning (sql4) on the job page after the external backup').not.toBe('');
      testInfo.annotations.push({ type: 'observed-outcome', description: 'sql4 line: ' + warning });
    });
  },
);
