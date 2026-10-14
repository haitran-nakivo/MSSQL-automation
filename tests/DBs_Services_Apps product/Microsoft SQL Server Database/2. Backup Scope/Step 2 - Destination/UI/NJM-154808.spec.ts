import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupSource } from '../../../../../../helpers/backup-env';
import { DEFAULT_DESTINATION_TOOLTIP, DestinationFlows, WIZARD_CASE_VS_UI } from '../../../../../../flows/bkA4-destination.flows';

// NJM-154808: "[DBM-BK-UI-Dest-0015-2-4] Verify Default Dest Tooltip".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: none (the wizard is cancelled in afterEach).
// case-vs-ui: wizard path and step names (see WIZARD_CASE_VS_UI). The tooltip text observed on 2026-10-08 is "The backup repository to which all new items (those that
//   will be created in or moved to the source container) will be backed up."; the case expects "applies to child databases unless overridden": the spec asserts the
//   observed text, which speaks of NEW items of the container.
// UNVERIFIED: the hover target (the "Default Destination" label, then the combo) and that the tooltip is a leaf text node.
test.use(RUN_OPTIONS);
test.afterEach(async ({ page, backupFlows }) => {
  await new DestinationFlows(page, backupFlows).leaveWizard();
});

test('NAKIVO shows a tooltip about new items on the container Default Destination', { tag: '@NJM-154808' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(300_000);
  testInfo.annotations.push({ type: 'case-vs-ui', description: WIZARD_CASE_VS_UI });
  testInfo.annotations.push({
    type: 'case-vs-ui',
    description: 'The case expects a tooltip that the default applies to child databases unless overridden; the UI tooltip says it is the repository for all NEW items created in or moved to the source container.',
  });
  const dest = new DestinationFlows(page, backupFlows);
  const source = readBackupSource('INSTANCE');
  let tooltip: string[] = [];

  await test.step('1. Open Data Protection > + > Backup for Database: the wizard opens at the Source step', async () => {
    await backupFlows.openWizard();
    await expect(backupFlows.wizard.title).toContainText('Backup Job Wizard for Database');
  });
  await test.step('2. Tick the whole SQL item and click Next: the wizard advances to Destination', async () => {
    await backupFlows.selectSources([{ item: source.item }]);
    await backupFlows.next();
    await expect(dest.fastCombo).toBeVisible({ timeout: 30_000 });
  });
  await test.step('3. In Advanced setup hover the container Default Destination: a tooltip is displayed', async () => {
    await dest.openAdvanced();
    await dest.ensureBlockOpen(source.item);
    tooltip = await dest.defaultDestinationTooltip();
    testInfo.annotations.push({ type: 'observed-outcome', description: `Tooltip texts: ${tooltip.join(' ; ') || '(none)'}` });
    expect(tooltip.length, 'no tooltip appeared on hover').toBeGreaterThan(0);
  });
  await test.step('4. Read the tooltip text: it describes the default destination for new items of the container', async () => {
    expect(tooltip.join(' ')).toContain(DEFAULT_DESTINATION_TOOLTIP);
  });
});
