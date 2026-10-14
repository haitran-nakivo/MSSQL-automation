import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupRepo, readBackupSource } from '../../../../../../helpers/backup-env';
import { BkA6ScheduleFlows } from '../../../../../../flows/bkA6-schedule.flows';

// NJM-154840: "[DBM-BK-UI-Schedule-0001] Verify Schedule Step UI (Figma)".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login read by readBackupSource).
// Side effects: none (the wizard is opened and left without saving a job).
// case-vs-ui: the Figma mockup cannot be compared by a script. The step is checked against the OBSERVED 11.2.1 layout instead: the controls and labels that exist,
//   no two fields overlap and none runs past the window edge. Step 4 "Schedule card, toolbar and action buttons": the step has no card and no toolbar; the inline Schedule #1 block is checked.
// case-vs-ui: the wizard has 4 steps ("Step 1 - Databases" is the Source step, "Step 2 - Destination", "Step 3 - Schedule").
test.use(RUN_OPTIONS);

test('NAKIVO shows the Schedule step of the Backup for Database wizard with all controls laid out without overlap', { tag: '@NJM-154840' }, async ({ signedIn: _s, page, backupFlows, backupWizardPage }, testInfo) => {
  test.setTimeout(300_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const a6 = new BkA6ScheduleFlows(page, backupFlows);

  await test.step('1. Precondition: open Data Protection > + > Backup for Database: the wizard opens at Step 1 (Source)', async () => {
    await backupFlows.openWizard();
    await expect(backupWizardPage.title).toBeVisible();
    await expect(backupWizardPage.selectionSummary).toContainText('Select at least one item on the left');
  });

  await test.step('2. Select a database, go to Destination, select the repository and go to the Schedule step', async () => {
    await a6.fromSourceToSchedule(source.item, db, repo);
    await expect(a6.ui.header(0)).toBeVisible();
  });

  await test.step('3. Compare the layout against the approved mockup (observed 11.2.1 layout: every control and label of the step is present)', async () => {
    const text = (await backupFlows.visibleTexts()).join('\n');
    for (const label of ['Do not schedule, run on demand', 'Prioritize schedules', 'Schedule #1', 'Keep backups for', 'SQL backup type', 'Add another schedule', 'Show calendar']) {
      expect(text, `the Schedule step does not show "${label}"`).toContain(label);
    }
    for (const field of [a6.ui.typeInput(0), a6.ui.nameInput(0), a6.ui.startAtInput(0), a6.ui.keepCountInput(0), a6.ui.sqlTypeInput(0)]) {
      await expect(field).toBeVisible();
    }
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Figma mockup not compared automatically; the observed 11.2.1 layout is asserted instead' });
  });

  await test.step('4. Inspect the step for rendering defects: no overlapping fields and nothing past the window edge', async () => {
    const boxes = await a6.fieldBoxes();
    expect(boxes.length, 'no named field is rendered on the Schedule step').toBeGreaterThan(3);
    for (const box of boxes) expect(box.x + box.w, `field ${box.name} runs past the window edge`).toBeLessThanOrEqual(box.viewportWidth + 1);
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

  await test.step('Ad hoc (negative): Cancel leaves the wizard and no job is created', async () => {
    await a6.closeEditor();
    await expect(backupWizardPage.title).toBeHidden({ timeout: 15_000 });
  });
});
