import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { BkKit } from '../../../../../../helpers/bkA1-steps';

// NJM-159778: "Verify RPs in the repository after each successful backup operation. (Ref: MSSQL-BK-Exe-0007)".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates job NJM-159778 (deleted in afterEach, backups kept); runs Full, Differential and Log once each; adds a small table qa_bk_changes (dropped in afterEach); the recovery model is set to FULL if it differs and restored.
// case-vs-ui: the case wants a repository with no earlier recovery points for the database; that cannot be seen from the UI, so the counts are deltas of msdb.backupset (NBR device) since the case started.
// case-vs-ui: wizard has 4 steps; first run is Full; types Incremental (Differential / Log) = msdb types I / L.
test.use(RUN_OPTIONS);

let kit: BkKit | undefined;
test.afterEach(async () => {
  await kit?.cleanup();
  kit = undefined;
});

test(
  'NAKIVO adds exactly one recovery point of the matching type after each successful Full, Differential and Log run',
  { tag: '@NJM-159778' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(1_200_000);
    kit = new BkKit({ key: 'NJM-159778', kind: 'INSTANCE', model: 'FULL' }, { page, backupFlows, testInfo });
    kit.commonCaseVsUi();

    await test.step('1. Precondition: the FULL-recovery database is in Inventory and the stream repository is named in .env', async () => {
      await kit.checkInventory();
      kit.checkRepositoryNamed();
      await kit.setRecoveryModel();
    });

    await test.step('2. Create the job and run it as a Full backup: it completes successfully', async () => {
      await kit.openWizardOnSource();
      await kit.selectDatabase();
      await kit.chooseRepository();
      await kit.fillOnDemandAndName();
      await kit.finishAndRunFirstFull();
      await kit.waitSuccess();
    });

    await test.step('3. Recovery points after the Full backup: exactly one, of type Full', async () => {
      await kit.expectNewRecoveryPoints(['D']);
    });

    await test.step('4. Run the job as a Differential backup: a second recovery point (Differential) is added', async () => {
      await kit.changeData();
      await kit.runAs('Differential');
      await kit.waitSuccess();
      await kit.expectNewRecoveryPoints(['I'], false);
    });

    await test.step('5. Run the job as a Log backup: a third recovery point (Log) is added', async () => {
      await kit.changeData();
      await kit.runAs('Log');
      await kit.waitSuccess();
      await kit.expectNewRecoveryPoints(['L'], false);
    });

    await test.step('6. Running count: three new recovery points in the order Full, Differential, Log, one per successful run', async () => {
      const all = await kit.allFreshSinceBaseline();
      expect(all.map((row) => row.type)).toEqual(['D', 'I', 'L']);
    });
  },
);
