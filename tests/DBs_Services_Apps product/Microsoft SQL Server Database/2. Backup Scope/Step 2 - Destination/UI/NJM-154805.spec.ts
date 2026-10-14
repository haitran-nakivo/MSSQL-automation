import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154805: "[DBM-BK-UI-Dest-0015-2-1] Verify Default Dest Required".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// Precondition: no default destination (two or more repositories exist), otherwise the dropdown is not empty: ABORTED.
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The notes say Next with an empty Fast setup combo only stays on the step (no invalid mark);
//   whether the default destination is highlighted red was not recorded: the highlight is a soft assertion and the outcome is attached, while "Next is blocked" is hard.
// UNVERIFIED: the invalid mark (aria-invalid, an invalid-like class or a red border).
// Ad hoc (negative): Next is blocked while the default destination is empty.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO treats the container Default Destination as required and clears the mark when a repository is chosen', { tag: '@NJM-154805' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const repo = readBackupRepo('PRIMARY');

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the whole SQL item and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
    if (await dest.hasDefaultDestination()) throw new Error('ABORTED: the wizard pre-selected a destination (only one repository exists); two repositories are needed');
  });
  await test.step('3. In Advanced setup leave the Default Destination empty: it is marked as required', async () => {
    await dest.openAdvanced();
    await dest.ensureBlockOpen(source.item);
    expect(await dest.defaultDestinationCombo().inputValue()).not.toContain(repo);
    await backupFlows.next();
    expect(await dest.scheduleStepShown(), 'Next advanced to the Schedule step with an empty Default Destination').toBe(false);
    const marked = await dest.isMarkedInvalid(dest.defaultDestinationCombo());
    testInfo.annotations.push({ type: 'observed-outcome', description: `Default Destination marked invalid after Next with no repository: ${marked}` });
    expect.soft(marked, 'the empty Default Destination is not highlighted as required').toBe(true);
  });
  await test.step('4. Select a repository: the required mark clears', async () => {
    await dest.setDefaultDestination(repo);
    await expect(dest.defaultDestinationCombo()).toHaveValue(new RegExp(repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    expect(await dest.isMarkedInvalid(dest.defaultDestinationCombo())).toBe(false);
  });
});
