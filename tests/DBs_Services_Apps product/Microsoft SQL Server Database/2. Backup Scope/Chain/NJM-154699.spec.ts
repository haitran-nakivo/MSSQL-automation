import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupValue } from '../../../../../helpers/backup-env';
import { WizardUiFlows } from '../../../../../flows/bkA2-wizard.flows';

// NJM-154699: "[MSSQL-BK-General-0003] Verify Glossary Definitions" (UI terminology matches the Glossary).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY.
// Side effects: none (the wizard is walked to Schedule and cancelled).
// PARTIAL: only step 1 (the backup-type labels shown by the wizard) can be checked by a script. Step 2 (consistency with the product glossary, knowledge/product/glossary.md) is a human review of wording;
//   what is asserted is the label set: Full, Differential, Log, and no "Incremental" (the glossary's replica / backup "Incremental" is not a SQL backup type of this product, notes 2026-10-08).
// case-vs-ui: the case says the wizard shows "chain" labels; no chain label exists in the 4-step wizard (checked: the word "chain" is not on the Schedule step).
test.use(RUN_OPTIONS);

test.afterEach(async ({ page, backupFlows }) => {
  try { await new WizardUiFlows(page, backupFlows).leaveWizardIfOpen(); } catch { /* best effort */ }
});

test('NAKIVO wizard labels the SQL backup types Full, Differential and Log', { tag: '@NJM-154699' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const item = readBackupValue('INSTANCE_ITEM');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const wiz = new WizardUiFlows(page, backupFlows);

  await test.step('1. Open the database backup wizard and review the backup-type labels on Schedule: Full, Differential, Log', async () => {
    await wiz.walkTo('Schedule', { item, databases: [db], repo });
    await backupWizardPage.sqlBackupTypeField().click({ timeout: 10_000 });
    const items = await page.locator('.x-boundlist-item:visible').allInnerTexts();
    expect(items.map((t) => t.trim())).toEqual(['Full', 'Differential', 'Log']);
    await page.keyboard.press('Escape');
  });

  await test.step('2. Compare the terminology with the glossary: Full, Differential and Log are used; "Incremental" is not offered', async () => {
    expect(await wiz.textVisible('Incremental', false)).toBe(false);
    expect(await wiz.textVisible(/chain/i, false)).toBe(false);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'The wording review against the glossary is manual; only the label set is asserted. No "chain" label is shown in the wizard.' });
  });
});
