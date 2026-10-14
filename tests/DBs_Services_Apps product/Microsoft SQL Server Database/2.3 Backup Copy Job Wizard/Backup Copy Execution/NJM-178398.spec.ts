import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178398: "Verify copy handles each recovery model's supported backup types".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_INSTANCE_DB_BULK_LOGGED, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates three source backup jobs (one per database) and Backup Copy job NJM-178398; afterEach deletes all with their backups. The recovery models are only READ (ABORTED when a database is not in the model its variable names); nothing is altered.
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: "Configuration > Repositories" and "Activities page": the repository contents are read from Settings > Repositories > <repo> (UNVERIFIED) and the run result from the copy job page (status line and events); Activities was not used.
// case-vs-ui: the case says "create a Backup Copy job" from Data Protection > + (Create) > Backup Copy Job; the wizard step names follow the case folders, not an observed UI.
test.use(RUN_OPTIONS);

let copy: CopyFlows | undefined;
test.afterEach(async () => {
  try {
    await copy?.cleanup();
  } catch {
    /* best effort */
  }
  copy = undefined;
});

test(
  'NAKIVO Backup Copy copies only the backup types each recovery model supports (SIMPLE: Full/Differential; FULL and BULK_LOGGED: also Log)',
  { tag: '@NJM-178398' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(2400000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const dbs = { SIMPLE: readBackupDatabase('INSTANCE', 'SIMPLE'), FULL: readBackupDatabase('INSTANCE', 'FULL'), BULK_LOGGED: readBackupDatabase('INSTANCE', 'BULK_LOGGED') };
    const primary = readBackupRepo('PRIMARY');
    const secondary = readBackupRepo('SECONDARY');
    const host = sqlHostFor(source);
    const copyJob = backupJobName('NJM-178398');

    await test.step('1. The three databases are in SIMPLE, FULL and BULK_LOGGED recovery', async () => {
      for (const model of ['SIMPLE', 'FULL', 'BULK_LOGGED'] as const) {
        const actual = await host.recoveryModel(dbs[model]);
        if (actual !== model) throw new Error('ABORTED: database ' + dbs[model] + ' is ' + actual + ', the variable NAKIVO_BK_INSTANCE_DB_' + model + ' needs ' + model);
      }
      const targetTexts = await flow.repositoryTexts(secondary);
      for (const name of Object.values(dbs)) {
        if (targetTexts.some((t) => t.includes(name))) throw new Error('ABORTED: the target already holds a backup of ' + name);
      }
    });

    await test.step('2. Run backups: SIMPLE Full/Differential; FULL and BULK_LOGGED Full/Differential/Log', async () => {
      const plans: Array<[string, string, Array<'Full' | 'Differential' | 'Log'>]> = [
        ['SIMPLE', dbs.SIMPLE, ['Full', 'Differential']],
        ['FULL', dbs.FULL, ['Full', 'Differential', 'Log']],
        ['BULK_LOGGED', dbs.BULK_LOGGED, ['Full', 'Differential', 'Log']],
      ];
      for (const [model, name, types] of plans) {
        const outcomes = await flow.seedSourceChain({ jobName: backupJobName('NJM-178398', '-src-' + model), item: source.item, databases: [name], repo: primary, types }, 300_000);
        expect(outcomes.every((o) => o === 'successful'), 'every ' + model + ' source run ends successfully').toBe(true);
      }
    });

    await test.step('3. Run the Backup Copy job for the three databases', async () => {
      await flow.createCopyJob({ name: copyJob, item: source.item, databases: [dbs.SIMPLE, dbs.FULL, dbs.BULK_LOGGED], destination: secondary });
      const outcome = await flow.runJob(copyJob, 1_200_000);
      expect(outcome, 'the Backup Copy job completes for all databases').toBe('successful');
    });

    await test.step('4. Inspect the copied recovery points per database', async () => {
      const targetTexts = await flow.repositoryTexts(secondary);
      for (const name of Object.values(dbs)) expect(targetTexts.some((t) => t.includes(name)), name + ' is on the target').toBe(true);
      const counts = flow.typeCounts(targetTexts);
      expect(counts.full, 'a Full per database').toBeGreaterThanOrEqual(3);
      expect(counts.log, 'Log points exist (FULL and BULK_LOGGED only)').toBeGreaterThan(0);
      note('observed-outcome', 'per-database split is not derivable from a flat listing; target listing: ' + targetTexts.slice(0, 60).join(' | '));
    });

    await test.step('5. No unsupported backup type was copied', async () => {
      note('observed-outcome', 'a SIMPLE-database Log point cannot exist: the source run of a Log on SIMPLE fails (sql3) and none was requested; per-database chain validity needs the live listing structure');
    });
  },
);
