import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../helpers/backup-env';
import { CopyFlows } from '../../../../../flows/bkA8-copy.flows';

// NJM-178380: "Verify 'Maintain exact copy' disabled applies the copy job retention over the source".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_REPO_SECONDARY, NAKIVO_MSSQL_INSTANCE_* (SQL login).
// Side effects: creates source backup job NJM-178380-src and Backup Copy job NJM-178380; afterEach deletes both with their backups. ABORTED when the target already holds a backup of the database.
// UNVERIFIED: the Backup Copy Job wizard and the Repositories view were never opened in the UI exploration; their locators are text-based guesses (pages/bkA8-copy-wizard.page.ts).
// case-vs-ui: the cases say "Jobs > Create > Backup copy job for Microsoft SQL Server": the UI entry is Data Protection > + > Backup Copy Job (a Microsoft SQL Server choice may follow; UNVERIFIED).
// case-vs-ui: the cases describe five steps (Source, Destination, Schedule, Retention, Options); the wizard is only checked for the steps it really shows (CopyFlows.presentSteps) and a missing step is recorded as case-vs-ui.
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
  'NAKIVO Backup Copy with "Maintain exact copy" disabled applies its own retention on the target',
  { tag: '@NJM-178380' },
  async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
    test.setTimeout(1800000);
    const note = (type: string, description: string): void => {
      testInfo.annotations.push({ type, description });
    };
    copy = new CopyFlows(page, backupFlows);
    const flow = copy;
    const source = readBackupSource('INSTANCE');
    const db = readBackupDatabase('INSTANCE', 'FULL');
    const primary = readBackupRepo('PRIMARY');
    const secondary = readBackupRepo('SECONDARY');
    const srcJob = backupJobName('NJM-178380', '-src');
    const copyJob = backupJobName('NJM-178380');

    await test.step('1. Precondition: the source retention differs from the intended copy policy (source keeps all, copy keeps 2)', async () => {
      if ((await flow.repositoryTexts(secondary)).some((t) => t.includes(db))) throw new Error('ABORTED: the target repository ' + secondary + ' already holds a backup of ' + db);
      const outcomes = await flow.seedSourceChain({ jobName: srcJob, item: source.item, databases: [db], repo: primary, types: ['Full', 'Differential', 'Differential', 'Differential'] }, 300_000);
      expect(outcomes.every((o) => o === 'successful'), 'every source backup run ends successfully').toBe(true);
    });

    await test.step('2. Open the wizard and reach the Retention step', async () => {
      const request = { name: copyJob, item: source.item, databases: [db], destination: secondary, retention: { exactCopy: false, count: 2 } };
      await flow.openWizard();
      const reached = await flow.advanceTo('Retention', request);
      if (!reached) {
        note('case-vs-ui', 'the wizard has no Retention step; the controls are looked for on the Schedule step');
        await flow.advanceTo('Schedule', request);
      }
      await expect(flow.wizard.maintainExactCopy).toBeVisible();
    });

    await test.step('3. Leave exact copy disabled and set keep 2 recovery points: the fields are editable', async () => {
      await flow.setCheckbox(flow.wizard.maintainExactCopy, false);
      const field = flow.wizard.retentionCountField();
      expect(await backupFlows.isDisabled(field), 'the copy retention field is editable').toBe(false);
      await flow.typeInto(field, '2');
      await expect(field).toHaveValue('2');
    });

    await test.step('4. Finish the wizard and run the copy job', async () => {
      await flow.completeFromSource({ name: copyJob, item: source.item, databases: [db], destination: secondary, retention: { exactCopy: false, count: 2 } });
      expect(await flow.runJob(copyJob, 900_000), 'the copy run ends successfully').toBe('successful');
    });

    await test.step('5. The copy retention (2 points) is applied to the target, not the source retention', async () => {
      const targetCounts = flow.typeCounts(await flow.repositoryTexts(secondary));
      expect(targetCounts.incremental, 'only the two newest Differentials are on the target').toBe(2);
    });
  },
);
