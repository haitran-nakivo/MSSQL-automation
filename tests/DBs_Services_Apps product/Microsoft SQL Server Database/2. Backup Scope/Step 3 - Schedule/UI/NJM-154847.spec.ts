import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154847: "[MSSQL-BK-UI-Sche-0003-2] Verify SQL Backup Type Tooltip".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: none (the wizard is opened and left without saving a job).
// case-vs-ui: no Create Schedule dialog in 11.2.1; the tooltip belongs to the SQL backup type field of the inline Schedule #1 block.
// case-vs-ui: the exploration notes disagree on this tooltip: one pass saw NO tooltip on the info icon of the SQL backup type, another saw text (Full: whole database; Differential: changes since the last
//   full; Log: needs a full backup, not supported for the SIMPLE recovery model). The case expects a tooltip, so a missing tooltip fails step 3 (a product deviation from the spec). The case says
//   "matches the spec exactly" but the spec text is not in the case: the check is that the text names Full, Differential, Log and the SIMPLE recovery model; the full text is attached as observed-outcome.
// UNVERIFIED: the info icon is found as the first qmMain element after the combo (pages/bkA6-schedule.page.ts sqlTypeInfoIcon).
test.use(RUN_OPTIONS);

test('NAKIVO shows a tooltip on the SQL backup type field explaining Full, Differential, Log and the SIMPLE recovery model restriction', { tag: '@NJM-154847' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const a6 = new BkA6ScheduleFlows(page, backupFlows);
  let tooltip = '';

  await test.step('1. Precondition: open Data Protection > + > Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupWizardPage.title).toBeVisible();
  });

  await test.step('2. Select a database, go to Destination, select the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.sqlTypeInput(0)).toBeVisible();
  });

  await test.step('3. Hover over the SQL backup type field / info icon: a tooltip is displayed', async () => {
    let texts = await a6.hoverTexts(a6.ui.sqlTypeInfoIcon(0));
    if (texts.length === 0) texts = await a6.hoverTexts(a6.ui.sqlTypeLabel(0));
    tooltip = texts.join(' ');
    testInfo.annotations.push({ type: 'observed-outcome', description: `SQL backup type tooltip text: "${tooltip}"` });
    expect(texts.length, 'hovering the SQL backup type field / info icon shows no tooltip').toBeGreaterThan(0);
  });

  await test.step('4. Read the tooltip: it describes Full, Differential, Log and that Log is not supported for the SIMPLE recovery model', async () => {
    expect(tooltip).toMatch(/Full/);
    expect(tooltip).toMatch(/Differential/);
    expect(tooltip).toMatch(/Log/);
    expect(tooltip).toMatch(/SIMPLE/i);
  });
});
