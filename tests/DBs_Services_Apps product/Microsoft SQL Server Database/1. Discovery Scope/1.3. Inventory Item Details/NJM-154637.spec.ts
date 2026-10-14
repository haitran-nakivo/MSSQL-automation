import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';
import { ObsBFlows } from '../../../../../flows/pkg-obsB.flows';

// NJM-154637: "[DBM-Inv-UI-Details-0004] Verify 'X Issues' Count Accuracy".
// Lab preconditions: the failover cluster instance item FCI-33.140 is in Inventory and reports issues (observed 2026-10-09: Inaccessible, "28 Issues").
//   If the item has no issues the badge reads "No Issues" and the test fails at step 3.
// Inventory side effects: none (the item is only read; nothing is refreshed, resolved or introduced).
// case-vs-ui (step 1): the item with a known issue count is FCI-33.140 (the instance WS2022-SQL2025-19.145 shows "No Issues"); the count is not hard-coded.
// case-vs-ui (step 2): the Inventory page is Settings > Inventory; the summary bar is the item page header with the health badge.
// case-vs-ui (step 3): the widget reads "<n> Issues" (link in the health badge); the case's word "X Issues" is that badge.
// case-vs-ui (step 4): the count is compared with the number in the "<n> Issues require your attention" heading of the same page; the number of
//   alarm lines is not counted (no locator for the lines).
// case-vs-ui (step 5): not executed. Resolving or introducing an issue on the source and refreshing the item is not available to the test.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page shows an Issues badge whose count equals the issues heading of the page',
  { tag: '@NJM-154637' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const obs = new ObsBFlows(page);
    const name = LAB_ITEMS.failoverCluster;

    await test.step('1. Precondition: the SQL item with issues is listed in the Inventory', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154637 step 1: the item with issues is FCI-33.140 (Inaccessible); the standalone instance shows "No Issues".' });
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.item(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory view and the details of the item: the item page with its health badge is visible', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154637 step 2: Settings > Inventory; the summary bar is the item page header.' });
      await flows.openItem(name);
      await expect(obs.healthBadge()).toBeVisible();
    });

    await test.step('3. Read the Issues widget: it shows a numeric count', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154637 step 3: the widget is the "<n> Issues" link of the health badge.' });
      await expect(obs.healthBadgeLink()).toHaveText(/^[1-9]\d* Issues$/);
      await expect(obs.healthBadgeIcon()).toHaveClass(/icon-notice/);
    });

    await test.step('4. Compare the count with the issues reported for the item: it equals the number in the issues heading of the page', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154637 step 4: compared with the "<n> Issues require your attention" heading; the alarm lines and the issues on the source are not counted.' });
      const badge = ((await obs.healthBadgeLink().textContent()) ?? '').trim();
      const badgeCount = /^(\d+) Issues$/.exec(badge)?.[1];
      expect(badgeCount, `the badge text "${badge}" has no count`).toBeDefined();
      await expect(obs.issuesHeading()).toBeVisible();
      await expect(obs.issuesHeading()).toContainText(`${badgeCount} Issues require your attention`);
    });

    await test.step('5. Resolve or introduce an issue and refresh: not executed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154637 step 5: not executed; changing the source and refreshing a pre-existing item is not allowed. The count update is not verified.' });
      await expect(obs.healthBadgeLink()).toBeVisible();
    });
  },
);
