import { test } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkKit } from '../../../../../../helpers/bkA1-steps';

// NJM-159774: "Verify Full Backup run interrupted by an external Log backup creation (Ref: MSSQL-BK-Exe-0002)".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates job NJM-159774 (deleted in afterEach, backups kept); runs Full runs and takes native Log backups of the database (they break the chain on purpose); the recovery model is set to FULL if it differs and restored.
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
  'NAKIVO completes a Full backup that an external Log backup of the same database overlaps, and keeps the chain valid',
  { tag: '@NJM-159774' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(1_200_000);
    kit = new BkKit({ key: 'NJM-159774', kind: 'INSTANCE', model: 'FULL' }, { page, backupFlows, testInfo });
    kit.commonCaseVsUi();

    await test.step('1. Precondition: Director up, the SQL database is reachable in FULL recovery model, the stream repository is configured', async () => {
      await kit.checkInventory();
      kit.checkRepositoryNamed();
      await kit.setRecoveryModel();
      await kit.ensureSomeFullExists();
    });

    await test.step('2. Create the job and start it as a Full backup: it shows as running', async () => {
      await kit.openWizardOnSource();
      await kit.selectDatabase();
      await kit.chooseRepository();
      await kit.fillOnDemandAndName();
      await kit.finishAndRunFirstFull();
    });

    await test.step('3. While it runs, create an external (native) Log backup of the same database on the SQL Server', async () => {
      const stillRunning = await kit.externalBackup('LOG');
      testInfo.annotations.push({ type: 'observed-outcome', description: 'The NBR job was still Running when the external Log backup finished: ' + stillRunning });
    });

    await test.step('4. Wait for the NBR Full backup to finish: it completes successfully and is not aborted', async () => {
      await kit.waitSuccess();
    });

    await test.step('5. Inspect the recovery point of the run: a valid Full recovery point (msdb type D) is present', async () => {
      await kit.annotateHistory('after the interrupted Full run');
      await kit.expectNewRecoveryPoints(['D']);
    });

    await test.step('6. Check the job events and the source database: no failure, the database is ONLINE in FULL recovery', async () => {
      await kit.expectNoFailureAndHealthyDatabase();
    });

    await test.step('Ad hoc: after another external Log backup the next Full run still succeeds and adds a Full recovery point', async () => {
      await kit.changeData();
      await kit.externalBackup('LOG');
      await kit.runAs('Full');
      await kit.waitSuccess();
      await kit.expectNewRecoveryPoints(['D'], false);
    });
  },
);
