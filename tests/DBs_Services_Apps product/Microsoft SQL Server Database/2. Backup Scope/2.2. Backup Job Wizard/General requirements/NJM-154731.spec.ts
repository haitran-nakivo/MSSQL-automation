import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { WizardUiFlows } from '../../../../../../flows/bkA2-wizard.flows';

// NJM-154731: "[DBM-Creat Job-UI-0003] Verify Option Disabled (Preconditions Not Met)".
// Env: none from .env. The case needs a Director whose Inventory holds NO SQL Server item (the case title also names "no Transporter" and "no Repository").
//   The lab Inventory normally holds SQL items, so this spec ends ABORTED ("Inventory is not empty") unless the owner points it at an empty Director.
// Side effects: none (the Create menu is opened; a click on the disabled entry is attempted).
// case-vs-ui: the case says Jobs > Create; the UI is Data Protection > "+". Whether the entry is really greyed in this state is not known from the notes (UNVERIFIED);
//   the spec asserts the case's expectation and records the observed state.
test.use(RUN_OPTIONS);

test('NAKIVO disables the Backup for Database entry of the Create menu when no SQL Server item is in Inventory', { tag: '@NJM-154731' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows, inventoryPage, backupJobPage, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Precondition: no SQL Server instance is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    const count = await inventoryPage.itemCount();
    if (count > 0) throw new Error(`ABORTED: Inventory is not empty (${count} row(s)); this case needs a Director with no SQL Server item in Inventory`);
  });

  await test.step('2. Open Data Protection > +: the Backup for Database entry is visible', async () => {
    const entry = await wiz.openCreateMenu();
    await expect(entry).toBeVisible();
  });

  await test.step('3. Inspect the entry: it is disabled / greyed', async () => {
    const disabled = await backupFlows.isDisabled(backupJobPage.backupForDatabaseItem);
    testInfo.annotations.push({ type: 'observed-outcome', description: `Backup for Database entry disabled = ${disabled}` });
    expect(disabled).toBe(true);
  });

  await test.step('4. Click the disabled entry: it cannot be selected and the wizard does not open', async () => {
    await backupJobPage.backupForDatabaseItem.click({ force: true, timeout: 5_000 }).catch(() => undefined);
    await expect(backupWizardPage.title).toHaveCount(0);
    await wiz.closeMenu();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Jobs > Create in the case is Data Protection > + in the UI.' });
  });
});
