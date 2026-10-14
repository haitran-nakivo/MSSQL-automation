import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154800: "[DBM-BK-UI-Dest-0014] Verify Hover Highlight".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The highlight is detected as a change of the computed background / shadow / outline
//   of the row header and its three ancestors between not hovered and hovered; no colour is asserted (Figma is not available).
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO highlights an Advanced setup item row while it is hovered', { tag: '@NJM-154800' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  let resting = '';

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the database and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. In Advanced setup hover an item row: the row is visually highlighted', async () => {
    await dest.openAdvanced();
    await dest.moveAway();
    resting = await dest.backgroundSignature(dest.header(db));
    await dest.header(db).hover({ timeout: 10_000 });
    await expect.poll(() => dest.backgroundSignature(dest.header(db)), { timeout: 5_000, message: 'the hovered row looks the same as at rest' }).not.toBe(resting);
  });
  await test.step('4. Move the cursor away: the highlight is removed', async () => {
    await dest.moveAway();
    await expect.poll(() => dest.backgroundSignature(dest.header(db)), { timeout: 5_000 }).toBe(resting);
  });
});
