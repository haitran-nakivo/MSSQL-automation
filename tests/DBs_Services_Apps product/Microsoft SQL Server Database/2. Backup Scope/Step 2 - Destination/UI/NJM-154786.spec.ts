import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource, readBackupValue } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154786: "[DBM-BK-UI-Dest-0002-7] Verify Unsupported Repo Disabled".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_UNSUPPORTED (name of an existing repository that is not a stream
//   repository, for example a SaaS or tape one; not defined in helpers/backup-env, read with readBackupValue) (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The case title mentions a tooltip; the steps do not, and no tooltip was ever observed on the
//   Destination list: the hover text is attached as observed-outcome only.
// Whether the unsupported repository is listed at all is not known from the notes: if it is absent the spec ends ABORTED, not FAILED.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO shows a repository that cannot hold SQL backups as disabled in the Destination dropdown', { tag: '@NJM-154786' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  const unsupported = readBackupValue('REPO_UNSUPPORTED');
  let before = '';

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the database and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
    before = await dest.fastValue();
  });
  await test.step('3. Open the dropdown: the unsupported repository appears greyed out / disabled', async () => {
    await dest.openList();
    if ((await dest.text(unsupported).count()) === 0) throw new Error(`ABORTED: the repository "${unsupported}" is not listed in the Destination dropdown (NAKIVO_BK_REPO_UNSUPPORTED)`);
    const option = backupFlows.wizard.destinationOption(unsupported);
    expect(await backupFlows.isDisabled(option), 'the unsupported repository is not shown as disabled').toBe(true);
    const hover = await backupFlows.hoverTexts(option);
    testInfo.annotations.push({ type: 'observed-outcome', description: `Hover text over the disabled repository: ${hover.length ? hover.join(' ; ') : '(none)'}` });
  });
  await test.step('4. Attempt to select it: it cannot be selected as a destination', async () => {
    await backupFlows.wizard.destinationOption(unsupported).click({ timeout: 5_000, force: true }).catch(() => undefined);
    expect(await dest.fastValue()).not.toContain(unsupported);
    expect(await dest.fastValue()).toBe(before);
  });
});
