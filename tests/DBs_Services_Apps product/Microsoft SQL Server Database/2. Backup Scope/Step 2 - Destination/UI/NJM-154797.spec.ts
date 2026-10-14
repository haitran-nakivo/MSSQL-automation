import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupSource } from '../../../../../../helpers/backup-env';
import { DestinationFlows, EXISTING_BACKUP_CHECKBOX, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154797: "[DBM-BK-UI-Dest-0011] Verify Item Expansion".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The expandable item is the database row ("Click to expand"); its content is its destination controls.
// UNVERIFIED: the indicator markup; it is checked as "the expand hint count drops by one" and the row's markup signature is attached as observed-outcome.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO expands an Advanced setup item to show its content', { tag: '@NJM-154797' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');
  let hintsBefore = 0;

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the database and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item, databases: [db] }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. In Advanced setup click the collapsed item header: the item expands to show its content', async () => {
    await dest.openAdvanced();
    hintsBefore = await dest.expandedHintCount();
    expect(hintsBefore).toBeGreaterThan(0);
    await dest.toggle(db);
    await expect(dest.text(EXISTING_BACKUP_CHECKBOX).first()).toBeVisible();
    await expect(dest.rowCombo(db)).toBeVisible();
  });
  await test.step('4. Confirm the indicator reflects the expanded state', async () => {
    testInfo.annotations.push({ type: 'observed-outcome', description: `Icon-like elements of the expanded row: ${(await dest.iconSignature(db)).join(' ; ')}` });
    expect(await dest.expandedHintCount(), 'the "Click to expand" hint is still shown for the expanded item').toBeLessThan(hintsBefore);
  });
});
