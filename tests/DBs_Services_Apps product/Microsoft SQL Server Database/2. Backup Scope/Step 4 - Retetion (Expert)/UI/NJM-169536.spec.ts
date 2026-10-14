import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA5ActionsFlows } from '../../../../../../flows/bkA5-actions.flows';

// NJM-169536: "[DBM-BK-UI-Retention-0001] Verify Retention Figma".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login that readBackupSource also reads).
// Side effects: none: the wizard is never saved.
// case-vs-ui: the case says Jobs > Create > Microsoft SQL Server database backup job and "Step 1 - Databases"; the UI is Data Protection > + > Backup for Database and Step 1 is Source.
// case-vs-ui: the case has a separate "Step 4 - Retention (Expert)" step with keep recovery points, GFS and immutability controls; in 11.2.1 the wizard has 4 steps and retention is the inline "Keep backups for <n> <days|weeks|months>" row of Schedule step 3 (Observed); no GFS or immutability control was seen there.
// case-vs-ui: the Figma mockup cannot be reached from a test: layout is checked by presence and values of the controls only (attached as not automated).
// UNVERIFIED: the info-icon locator next to "Keep backups for".
test.use(RUN_OPTIONS);

test('NAKIVO shows the retention controls of the Schedule step with their defaults and tooltip', { tag: '@NJM-169536' }, async ({ signedIn: _signedIn, page, backupFlows }, testInfo) => {
  test.setTimeout(600_000);
  const actions = new BkA5ActionsFlows(page, backupFlows);
  testInfo.annotations.push({ type: 'case-vs-ui', description: "the case says Jobs > Create > Microsoft SQL Server database backup job and \"Step 1 - Databases\"; the UI is Data Protection > + > Backup for Database and Step 1 is Source. | the case has a separate \"Step 4 - Retention (Expert)\" step with keep recovery points, GFS and immutability controls; in 11.2.1 the wizard has 4 steps and retention is the inline \"Keep backups for <n> <days|weeks|months>\" row of Schedule step 3 (Observed); no GFS or immutability control was seen there. | the Figma mockup cannot be reached from a test: layout is checked by presence and values of the controls only (attached as not automated)." });
  const source = readBackupSource('INSTANCE');
  const db1 = readBackupDatabase('INSTANCE', 'SIMPLE');
  const repo = readBackupRepo('PRIMARY');
  await test.step('1. Open Data Protection, click + and choose Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toBeVisible();
  });
  await test.step('2. Advance through Source and Destination until the step with the retention settings (Schedule) is displayed', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db1] }]);
    await backupFlows.next();
    await backupFlows.chooseDestination(repo);
    await backupFlows.next();
    await expect(actions.o.keepBackupsLabel()).toBeVisible();
  });
  await test.step('3. Compare the retention layout with the mockup: the "Keep backups for" row shows a count and a unit', async () => {
    testInfo.annotations.push({ type: 'not-automated', description: 'Pixel comparison with the approved Figma mockup is not possible from a test; control presence and defaults are asserted instead.' });
    await expect(actions.o.keepBackupsCount()).toBeVisible();
    await expect(actions.o.keepBackupsCount()).toHaveValue('10');
    expect((await actions.o.keepBackupsUnit().inputValue()).toLowerCase()).toContain('day');
  });
  await test.step('4. Inspect the retention controls for rendering defects: the unit list offers days, weeks and months and the tooltip explains expiry', async () => {
    await actions.o.keepBackupsUnit().click({ timeout: 10_000 });
    const items = (await page.locator('.x-boundlist-item:visible').allInnerTexts()).map((text) => text.trim().toLowerCase());
    expect(items).toEqual(expect.arrayContaining(['days', 'weeks', 'months']));
    await backupFlows.wizard.boundListItem((await page.locator('.x-boundlist-item:visible').first().innerText()).trim()).click({ timeout: 10_000 });
    const tooltip = await backupFlows.hoverTexts(actions.o.keepBackupsInfoIcon());
    testInfo.annotations.push({ type: 'observed-outcome', description: 'retention tooltip: ' + JSON.stringify(tooltip) + '; GFS / immutability texts on the step: ' + JSON.stringify((await backupFlows.visibleTexts()).filter((text) => /GFS|immutab/i.test(text))) });
    expect(tooltip.join(' ')).toMatch(/expired recovery points/i);
  });
});
