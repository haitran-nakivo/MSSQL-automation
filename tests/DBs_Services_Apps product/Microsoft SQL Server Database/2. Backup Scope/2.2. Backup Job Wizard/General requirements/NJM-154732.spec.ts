import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { WizardUiFlows } from '../../../../../../flows/bkA2-wizard.flows';

// NJM-154732: "[DBM-Creat Job-UI-0004] Verify Tooltip for Missing Inventory".
// Env: none from .env. Needs a Director whose Inventory holds NO SQL Server item; the lab Inventory normally does, so this spec ends ABORTED ("Inventory is not empty")
//   unless the owner points it at an empty Director.
// Side effects: none (the Create menu is opened and the disabled entry is hovered).
// case-vs-ui: Jobs > Create is Data Protection > "+" in the UI. The tooltip text is not in the notes (UNVERIFIED); the case only says it explains that a SQL Server
//   instance must be added to Inventory, so the spec asserts a tooltip appears and mentions Inventory, and records the full text as observed-outcome.
test.use(RUN_OPTIONS);

test('NAKIVO shows an explanatory tooltip on the disabled Backup for Database entry when no SQL Server item is in Inventory', { tag: '@NJM-154732' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, inventoryPage, backupJobPage }, testInfo) => {
  test.setTimeout(300_000);
  const wiz = new WizardUiFlows(page, backupFlows);
  let tooltip: string[] = [];

  await test.step('1. Precondition: no SQL Server instance is in Inventory, so the entry is disabled', async () => {
    await inventoryFlows.gotoInventory();
    const count = await inventoryPage.itemCount();
    if (count > 0) throw new Error(`ABORTED: Inventory is not empty (${count} row(s)); this case needs a Director with no SQL Server item in Inventory`);
  });

  await test.step('2. Open Data Protection > + and hover the disabled Backup for Database entry: a tooltip is shown', async () => {
    await wiz.openCreateMenu();
    tooltip = await backupFlows.hoverTexts(backupJobPage.backupForDatabaseItem);
    expect(tooltip.length, 'no tooltip appeared on hover').toBeGreaterThan(0);
  });

  await test.step('3. Read the tooltip text: it says a SQL Server instance must be added to Inventory first', async () => {
    const text = tooltip.join(' ');
    testInfo.annotations.push({ type: 'observed-outcome', description: `Tooltip text: ${text}` });
    expect(text).toMatch(/inventory/i);
    await wiz.closeMenu();
  });
});
