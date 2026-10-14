import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';
import { ObsBFlows } from '../../../../../flows/pkg-obsB.flows';

// NJM-154638: "[DBM-Inv-UI-Details-0005] Verify 'X Issues' Button Behavior".
// Lab preconditions: the failover cluster instance item FCI-33.140 is in Inventory and reports issues (observed 2026-10-09: "28 Issues").
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 1): the item with issues is FCI-33.140; the count is not hard-coded.
// case-vs-ui (step 2): the Inventory page is Settings > Inventory; the summary bar is the item page header.
// case-vs-ui (step 3): the "<n> Issues" element is a link button (div.link-button.simple-link with the link a.slActive). What a click on it does is not
//   observed, so the test does not click it; it asserts that the element is that link button.
// case-vs-ui (step 4): NBR lists the issues on the item page itself, below the header, without a click: the heading "<n> Issues require your attention"
//   with a line per alarm. The test asserts the heading number equals the badge count; the alarm lines are not counted.
// case-vs-ui (step 5): there is no issues view to dismiss; the not-executed click means the header with the badge stays visible.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Inventory item page shows the Issues badge as a link button next to the list of issues',
  { tag: '@NJM-154638' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, page }, testInfo) => {
    test.setTimeout(300_000);
    const obs = new ObsBFlows(page);
    const name = LAB_ITEMS.failoverCluster;

    await test.step('1. Precondition: the SQL item with issues is listed in the Inventory', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154638 step 1: the item with issues is FCI-33.140 (Inaccessible).' });
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.item(name)).toBeVisible();
    });

    await test.step('2. Open the Inventory view and the details of the item: the header with the health badge is visible', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154638 step 2: Settings > Inventory; the summary bar is the item page header.' });
      await flows.openItem(name);
      await expect(obs.healthBadge()).toBeVisible();
      await expect(obs.healthBadgeLink()).toHaveText(/^[1-9]\d* Issues$/);
    });

    await test.step('3. The Issues element is a link button in the header', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154638 step 3: the element is asserted by its observed classes; it is not clicked because the click behavior is not observed.' });
      await expect(obs.healthBadge()).toHaveClass(/link-button/);
      await expect(obs.healthBadge()).toHaveClass(/simple-link/);
      await expect(obs.healthBadgeLink()).toBeEnabled();
    });

    await test.step('4. The list of issues is displayed and its heading matches the count shown on the badge', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154638 step 4: the issues are listed on the page below the header without a click; the heading number is compared, the alarm lines are not counted.' });
      const badge = ((await obs.healthBadgeLink().textContent()) ?? '').trim();
      const badgeCount = /^(\d+) Issues$/.exec(badge)?.[1];
      expect(badgeCount, `the badge text "${badge}" has no count`).toBeDefined();
      await expect(obs.issuesHeading()).toContainText(`${badgeCount} Issues require your attention`);
      await expect(page.getByText(`The "${name}" Microsoft SQL Server failover cluster instance is inaccessible`).filter({ visible: true }).first()).toBeVisible();
    });

    await test.step('5. The Details header with the badge is shown', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154638 step 5: no issues view is opened, so none is dismissed; the header stays visible.' });
      await expect(obs.healthBadge()).toBeVisible();
    });
  },
);
