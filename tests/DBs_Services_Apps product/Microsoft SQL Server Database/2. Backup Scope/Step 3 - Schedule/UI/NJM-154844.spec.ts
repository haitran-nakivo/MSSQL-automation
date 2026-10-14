import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154844: "[MSSQL-BK-UI-Sche-0002] Verify Create Schedule Dialog UI".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: none (the wizard is opened and left without saving a job).
// case-vs-ui: 11.2.1 has no "Create Schedule" dialog. "Add Schedule" is the inline link "Add another schedule": it appends a "Schedule #2" block with the same fields and a "Remove" link.
//   That block is what is asserted. The Figma mockup cannot be compared by a script (the layout is checked for overlap only).
test.use(RUN_OPTIONS);

test('NAKIVO adds a second inline schedule block with the same fields and removes it again (no Create Schedule dialog in 11.2.1)', { tag: '@NJM-154844' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const a6 = new BkA6ScheduleFlows(page, backupFlows);

  await test.step('1. Precondition: open Data Protection > + > Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupWizardPage.title).toBeVisible();
  });

  await test.step('2. Select a database, go to Destination, select the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
    expect(await a6.scheduleCount()).toBe(1);
  });

  await test.step('3. Click "Add another schedule" (the Add Schedule action): a Schedule #2 block opens inline, not a dialog', async () => {
    await a6.ui.addScheduleLink.click({ timeout: 10_000 });
    await expect(a6.ui.header(1)).toBeVisible();
    expect(await a6.scheduleCount()).toBe(2);
    await expect(page.locator('.x-window:visible').filter({ hasText: /Create schedule/i })).toHaveCount(0);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'no Create Schedule dialog in 11.2.1; "Add another schedule" adds an inline Schedule #2 block' });
  });

  await test.step('4. Inspect the new block against the mockup (not comparable by script): it has the same fields as Schedule #1, a Remove link, and nothing overlaps', async () => {
    await expect(a6.ui.nameInput(1)).toBeVisible();
    await expect(a6.ui.typeInput(1)).toBeVisible();
    await expect(a6.ui.keepCountInput(1)).toBeVisible();
    await expect(a6.ui.sqlTypeInput(1)).toBeVisible();
    await expect(a6.ui.removeLink(1)).toBeVisible();
    const boxes = await a6.fieldBoxes();
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlapW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(overlapW > 2 && overlapH > 2, `fields ${a.name} and ${b.name} overlap`).toBe(false);
      }
    }
  });

  await test.step('Ad hoc (negative): Remove deletes the added block and leaves Schedule #1', async () => {
    await a6.ui.removeLink(1).click({ timeout: 10_000 });
    await expect(a6.ui.header(1)).toBeHidden();
    expect(await a6.scheduleCount()).toBe(1);
  });
});
